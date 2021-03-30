const express = require('express');
const router = express.Router();
const joi = require("@hapi/joi");
const path = require('path');
const models = require('../models/user');


router.get('/dashboard', async (req,res) => {
  // return res.sendFile(path.join(__dirname, '../','views/dashboard.html'));
  res.render('dashboard.html');

    // if (req.session.user) {
    //   return res.sendFile(path.join(__dirname, '../views/dashboard.html'));
    //   // res.render("dashboard", {
    //   //   title: "User Dashboard – IsMailValid",
    //   //   page_link: "/dashboard/",
    //   //   name:req.session.user.name,
    //   //   email:req.session.user.email,
    //   //   isEmailVerified:req.session.user.isEmailVerified
    //   // });
    // }else{
    //   res.redirect('/');
    // }
    // res.json([]);
});

router.get('/thankyou', (req,res) => {
  res.send('thanks');
});

router.post('/update-existing-password', async (req,res) => {
    try {
        if(!req.session.user) {
          throw new Error("Invalid Session.");
        }
        const schema = joi.object().keys({
          oldPassword: joi.string().min(6).max(20).required(),
          currentPassword: joi.string().min(6).max(20).required(),
          confirmPassword: joi.string().min(6).max(20).required(),
        });
        const result = schema.validate(req.body);
        if (result.error) {
          throw result.error.details[0].message;
        }
        if (result.value.currentPassword !== result.value.confirmPassword) {
          throw new Error("Password mismatch");
        }
        result.value.email = req.session.user.email;
        let updatePasswordResult = await models.updateExistingPassword(result.value);
        res.json(updatePasswordResult);
      } catch (e) {
        res.json({ error: true, message: e });
      }    
});

module.exports = router;