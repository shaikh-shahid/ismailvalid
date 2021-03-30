const express = require('express');
const router = express.Router();
const joi = require("@hapi/joi");
const models = require('../models/user');

router.post('/login', async (req,res) => {
  try {
      const schema = joi.object().keys({
        email: joi.string().email().required(),
        password: joi.string().min(6).max(45).required()
      });
      const result = schema.validate(req.body);
      if (result.error) {
        throw result.error.details[0].message;
      }
      let checkUserLogin = await models.verifyUser(result.value);
      if (checkUserLogin.error) {
        throw checkUserLogin.message;
      }
      // set session for the logged in user
      req.session.user = checkUserLogin.data;
      res.json(checkUserLogin);
    } catch (e) {
      res.json({ error: true, message: e });
    }
});

router.post('/signup', async (req,res) => {
  try {
      const schema = joi.object().keys({
        name: joi.string().min(3).max(45).required(),
        email: joi.string().email().required(),
        password: joi.string().min(6).max(45).required(),
        accountType: joi.string().required()
      });
      const result = schema.validate(req.body);
      if (result.error) {
        throw result.error.details[0].message;
      }
      // add the IP address to get location data
      result.value.ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
      let addUserResponse = await models.addUser(result.value);
      // set session for the logged in user
      if(addUserResponse.error) {
        throw addUserResponse.message || "Error occurred while creating your account. Please try again or contact support";
      }
      req.session.user = addUserResponse.data;
      res.json({ error: false, "message": "Your account is successfully created."});
    } catch (e) {
        console.log(e);
      res.json({ error: true, message: e });
    }
});

router.get('/email-verification', async (req,res) => {
    try {
        let token = req.query.token;
        if (token) {
          let decodedToken = JSON.parse(
            Buffer.from(token, "base64").toString("ascii")
          );
          let result = await models.checkLinkVerification(decodedToken);
          if (result.error) {
            return res.send("<h2>Invalid token.</h2>");
          }
          // update session value if user is logged in
          if(req.session.user) {
            req.session.user.isEmailVerified = true;
          }
          // return response
          res.send("<h2>Email address successfully verified.</h2>");
        }
      } catch (e) {
        res.json({ error: true, message: e });
      }
});

router.post('/forgot-password', async (req,res) => {
    try {
        const schema = joi.object().keys({
          email: joi.string().email().required(),
        });
        const result = schema.validate(req.body);
        if (result.error) {
          throw result.error.details[0].message;
        }
        // send forgot password email
        let forgotPasswordResult = await models.forgotPassord(result.value);
        res.json(forgotPasswordResult);
      } catch (e) {
        res.json({ error: true, message: e });
      }    
});

router.post('/reset-password', async (req,res) => {
    try {
        let token = req.query.token;
        if (token) {
          let decodedToken = JSON.parse(
            Buffer.from(token, "base64").toString("ascii")
          );
          let result = await models.checkLinkVerification(decodedToken);
          if (result.error) {
            res.json({ error: true, message: 'error Invalid reset token. Please contact support.' });          
            // return res.render("reset-password", {
            //   title: "IsMailValid Reset-Password – Codeforgeek",
            //   errorStatus: true,
            //   errorMsg: "error Invalid reset token. Please contact support.",
            //   page_link: "/reset-password/",
            // });
          }
          res.json({error: false, message: 'render the page here to take new password'});
        //   res.render("reset-password", {
        //     title: "IsMailValid Reset-Password – Codeforgeek",
        //     errorStatus: false,
        //     page_link: "/reset-password/",
        //   });
        }
      } catch (e) {
        res.json({ error: true, message: e });          
        // res.render("reset-password", {
        //   title: "IsMailValid Reset-Password – Codeforgeek",
        //   errorStatus: true,
        //   errorMsg: "error Invalid reset token. Please contact support.",
        //   page_link: "/reset-password/",
        // });
      }    
});

router.post('/update-password', async (req,res) => {
    try {
        const schema = joi.object().keys({
          token: joi.string().required(),
          password: joi.string().min(6).max(20).required(),
          confirmPassword: joi.string().min(6).max(20).required(),
        });
        const result = schema.validate(req.body);
        if (result.error) {
          throw result.error.details[0].message;
        }
        if (result.value.password !== result.value.confirmPassword) {
          throw new Error("Password mismatch");
        }
        let decodedToken = JSON.parse(
          Buffer.from(result.value.token, "base64").toString("ascii")
        );
        let updatePasswordResult = await models.updateForgotPassword({
          email: decodedToken.email,
          password: result.value.password,
        });
        res.json(updatePasswordResult);
      } catch (e) {
        res.json({ error: true, message: e });
      }
});

router.post('/deleteAccount', async (req,res) => {
    try {
        if(!req.session.user) {
          throw new Error("Invalid Session.");
        }
        let deleteAccountResult = await models.deleteUserAccount({email: req.session.user.email});
        if(req.session.user) {
          req.session.destroy();
        }
        res.json(deleteAccountResult);
      } catch (e) {
        res.json({ error: true, message: e });
      }    
});

router.get('/logout', (req,res) => {
    if (req.session.user) {
        req.session.destroy((err) => {
          res.clearCookie('connect.sid',{ path:'/'} );
          res.redirect("/");
        });
      } else {
        res.redirect("/");
      }    
});

module.exports = router;