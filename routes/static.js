const express = require('express');
const router = express.Router();
const joi = require("@hapi/joi");

router.get('/', (req,res) => {
    res.send('homepage');
});

router.get('/login', (req,res) => {
    res.send('login page');
});

router.get('/signup', (req,res) => {
    res.send('signup page');
});

router.get('/product', (req,res) => {
    res.send('product page');
});

module.exports = router;