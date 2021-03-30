const express = require('express');
const validator = require('deep-email-validator');
const nconf = require('nconf');
const { updateApiCount } = require('../models/user');
const router = express.Router();

router.use((req,res,next) => {
    // check the validity of the token
    if(req.query.accesskey && typeof(req.query.accesskey) === 'string') {
        global.redis.get(req.query.accesskey, (err, response) => {
            if(err) {
                return res.send({error: true, message: "Error occurred. Please contact customer support"});
            }
            console.log(JSON.parse(response));
            if(response !== null) {
                let parsedResponse = JSON.parse(response);
                if(parsedResponse.status !== 'active') {
                    return res.send({error: true, message: "Your account is deactivated. Please contact support at twitter @ismailvalid"});                                        
                }
                if(parsedResponse.accountType === 'free' && parsedResponse.count > nconf.get('freeApiAllowed')) {
                    return res.send({error: true, message: "You have exceeded the free plan limit. Please upgrade your account to access the IsMailValid API."});                    
                }
                req.accountData = parsedResponse;
                return next();
            }
            return res.send({error: true, message: "Invalid access token. Please contact support at twitter @ismailvalid"});
        });
    }
});

// verify the email for its validity and return the results

router.get('/verify', async (req,res) => {
    try {
        let result = await validator.validate({email: req.query.email, validateSMTP: nconf.get("environment") === 'local' ? false: true });        
        const response = {
            isValid: result.valid,
            formatValid: result.validators.regex.valid,
            typoCheck: result.validators.typo.valid,
            mxCheck: result.validators.mx.valid,
            smtpCheck: result.validators.smtp.valid,
            disposable: result.validators.disposable.valid
        };
        var message = null;
        if(!result.valid) {            
            message = result.validators[result.reason].reason;
        } else {
            message = "Email is valid";
        }
        res.json({error: false, message: message ,data: response});
        await updateApiCount({accessKey: req.query.accesskey, accountData: req.accountData});
    }
    catch(e) {
        res.json({error: true, data: e});        
    }
});

module.exports = router;