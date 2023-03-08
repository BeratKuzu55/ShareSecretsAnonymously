//jshint esversion:6
require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mysql = require("mysql");
const validator = require("email-validator");
const md5 = require("md5");
const bcrypt = require('bcrypt');
const saltRounds = 10;
const session = require("express-session");
const mysqlStore = require("express-mysql-session")(session);
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const app = express();

let secrets_arr = [];

//console.log(process.env.SECRET);

const options = {
    host : "localhost" , 
    user : "root" , 
    password : "" , 
    database : "authentication"
}

const con = mysql.createConnection(options)

const sessionStore = new mysqlStore(options);  /// 
app.use(session({
    key : "mykey" ,
    secret : "our little secret" , 
    resave : false , 
    store : sessionStore ,
    saveUninitialized : false
}))

app.use(passport.initialize());
app.use(passport.session());

app.use(express.static("public"));
app.set('view engine' , 'ejs');
app.use(bodyParser.urlencoded({extended : true}));

passport.serializeUser((user , done) => {
    done(null , user.id);
    })
    passport.deserializeUser(function(user, done) {
    done(null, user);
    });

passport.use(new GoogleStrategy ({
    clientID : process.env.CLIENT_ID , 
    clientSecret : process.env.SECRET , 
    callbackURL : "http://localhost:3000/auth/google/secrets" , 
    userProfileURL : "https://www.googleapis.com/oauth2/v3/userinfo"
} , function(accessToken , refreshToken , profile , done){
    

    con.query(`select * from users where email = "${profile._json.email}"` , function(err , results){
        if(err) throw err;
       // console.log("ayni email adet sayisi ---> " + results.length);
        if(!results.length){
            bcrypt.hash(profile.id , saltRounds , function(err , hash){
    
                if(err) throw err;
                
                if(validator.validate(profile._json.email)){
                    con.query(`insert into users (email , password) values ('${profile._json.email}' , '${hash}')` , function (err) {
                        if(err) throw err;
                        //res.render("secrets");
                    });
                
                }
           }) 
           
           
        }
        
        
    })
       
    return done(null, profile);
    
}))

/*
    app.get('/auth/callback/success' , (req , res) => {
    if(!req.user)
    res.redirect('/auth/callback/failure');
    res.send("Welcome " + req.user.email);
    });
    
    // failure
    app.get('/auth/callback/failure' , (req , res) => {
    res.send("Error");
})

*/

app.get("/" , function(req , res){
    res.render("home");
})
app.get('/auth/google' , passport.authenticate('google', { scope:
    [ 'email', 'profile' ]
    }));


app.get("/auth/google/secrets" , passport.authenticate('google' , {failureRedirect: "/login"}) , function(req ,res){
    res.render("secrets");
})



app.get("/secrets" , function(req , res) {
    if(req.isAuthenticated){
        con.query(`select * from secrets` , function(err , results){
           for(var i = 0; i<results.length; i++){
                secrets_arr[i] = results[i].content;
                //console.log(secrets_arr[i]);
           }
        })
        
        res.render("secrets" , {postarrejs: secrets_arr});
    }else {
        res.redirect("/login");
    }
})

app.get("/submit" , function(req , res) {
    if(req.isAuthenticated){             //            !!!!!!!!!!!!!!!!!!!!!!!!!
        res.render("submit");
    }else {
        res.redirect("/login");
    }
})

app.post("/submit", function(req, res){
    const submittedSecret = req.body.secret;
  
   // console.log("current user ---------->" + req.session.user_email);
    let current_user_email = req.session.user_email;
    //console.log("current user ---------->" + current_user_email);
    con.query(`select * from users where email = '${current_user_email}'` , function(err , result){
        if(err) throw err;
       // console.log(result[0].email + " " + result[0].id + "<----------------------")
        con.query(`insert into secrets (content , email , userid) values ('${submittedSecret}' , '${result[0].email}' , ${result[0].id})` , function(err){
            res.redirect("/secrets");
        });
   
    })
   

  });

app.get("/login" , function(req , res){
    res.render("login");
})

app.get("/register" , function(req , res){
    res.render("register");
})

app.post("/register" , function (req , res) {
   
    // bcryp ile password
    let username = req.body.username; // email
   // let password = md5(req.body.password); md5 kullanımı
    let password = req.body.password;

con.query(`select * from users` , function(err , result){
    if(err) throw err;
    let users_lenght = result.length;
    let kontrol = false;

    for(var i = 0 ; i<result.length; i++){
        if(result[i].email === username){
            kontrol = true;
        }
    }

    if(!kontrol)
    {
        bcrypt.hash(password , saltRounds , function(err , hash){

            if(err) throw err;
    
            if(validator.validate(username)){
                con.query(`insert into users (email , password , id) values ('${username}' , '${hash}' , ${users_lenght + 1})` , function (err) {
                    if(err) throw err;
                    res.render("secrets");
                });
            }
            else {
                console.log("not valid");
            }
       })   
    }
    
})
          

})

app.post("/login" , function(req , res){

     // bcrypt ile 
    let username = req.body.username;
    //let password = md5(req.body.password);

    let password = req.body.password;
  
    con.query(`SELECT * FROM users` , function(err , rows){
        if(err) throw err;
        for (let index = 0; index < rows.length; index++) {
            console.log(rows[index].email);
             if(rows[index].email === username ){
                bcrypt.compare(password , rows[index].password , function(err, result){
                    if(err) throw err;
                    if(result){
                        req.session.user_email = username;
                        res.render("secrets" , {postarrejs: secrets_arr}); 
                    }
                })
               
             }
            
        }
     
    })    


})


app.get('/logout' , function(req , res){
    req.session.destroy(function(err){
        if(err) throw err;
        res.redirect("/")
    })
})
app.listen(3000 , function(){
    console.log("server started on port 3000");
})