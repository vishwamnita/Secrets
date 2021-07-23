//jshint esversion:6

require("dotenv").config();
const express = require("express");
const ejs = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const session = require("express-session");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const findOrCreate = require("mongoose-findorcreate")

const app = express();

app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({
    extended: true
}));

app.use(session({
    secret: "This is a secret choosen for encrypting the session.",
    resave: true,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());


mongoose.connect("mongodb://localhost:27017/userDB", {
    useNewUrlParser: true,
    useUnifiedTopology: true
    // useCreateIndex: true
});

mongoose.set("useCreateIndex", true);

const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    googleId: String,
    secrets: []
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy())

passport.serializeUser(function(user, done) {
    done(null, user.id);
});

passport.deserializeUser(function(id, done) {
    User.findById(id, function(err, user) {
        done(err, user);
    });
});

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
        return cb(err, user);
    });
  }
));

app.get("/", function(req, res) {
    res.render("home");
});

app.get("/auth/google", passport.authenticate("google", {scope: ["profile"] }));

app.get("/auth/google/secrets",
    passport.authenticate("google", { failureRedirect: "/login" }),
    function(req, res) {
    // Successful authentication, redirect home.
    res.redirect("/secrets");
});


app.get("/login", function(req, res) {
    res.render("login");
});

app.get("/register", function(req, res) {
    res.render("register");
});

app.get("/secrets", function(req, res) {
    allSecrets = [];
    User.find({secrets: {$ne: null}}, function(err, foundUsers) {
        if(!err) {
            foundUsers.forEach((user) => {
                user.secrets.forEach((secret) => {
                    allSecrets.push(secret);
                });
            });
            res.render("secrets", {allSecretsView: allSecrets});
        }
        else {
            console.log(err);
        }
    });
});

app.get("/logout", function(req, res) {
    req.logout();
    res.redirect("/");
});

app.get("/submit", function(req, res) {
    if(req.isAuthenticated()) {
        res.render("submit");
    }
    else {
        res.redirect("/login");
    }
});

app.post("/register", function(req, res) {
    User.register({username: req.body.username}, req.body.password, function(err, user) {
        if(!err) {
            passport.authenticate("local")(req, res, function() {
                res.redirect("/secrets");
            });
        }
        else {
            console.log(err, req.body.username, req.body.password);
            res.redirect("/register");
        }
    })
});

app.post("/login", function(req, res) {
    const user = new User({
        username: req.body.username,
        password: req.body.password
    });

    req.login(user, function(err) {
        if(err) {
            console.log(err);
        } else {
            passport.authenticate("local")(req, res, function() {
                res.redirect("/secrets");
            });
        }
    });
});

app.post("/submit", function(req, res) {
    const submittedSecret = req.body.secret;
    User.findById(req.user.id, function(err, foundUser) {
        if(!err) {
            if(foundUser) {
                foundUser.secrets.push(submittedSecret);
                foundUser.save();
                res.redirect("/secrets");
            }
        }
        else {
            console.log(err);
        }
    });
});


const port = process.env.PORT || 3000;

app.listen(port, function(req, res) {
    console.log(`App listening on http://localhost:${port}`);
})