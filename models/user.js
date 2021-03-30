const bcrypt = require("bcrypt");
const { lookup } = require('geoip-lite');
const { uuid } = require("uuidv4");
const nconf = require('nconf');
const crypto = require('crypto');

/**
 * @addUser
 */

function addUser(userData) {
  return new Promise(async (resolve, reject) => {
    try {
      // check if user does not exists
      let checkUserData = await checkIfUserExists({ email: userData.email });
      if (checkUserData.data && checkUserData.data.length > 0) {
        // user already exists, send response
        return resolve({
          error: true,
          message: "User already exists with this credentials. Please login",
          data: [],
        });
      }
      // generate password hash
      let passwordHash = await bcrypt.hash(userData.password, 15);
      userData.password = passwordHash;
      // add account api key
      userData.apiKey = crypto.randomBytes(16).toString("hex");
      // add email verification flag
      userData.isEmailVerified = false;
      // add account status flag
      userData.accountStatus = "active";
      // update the api count
      userData.apiCount = 0;
      // add user location
      userData.location = lookup(userData.ip);
      // add time of creation
      userData.createdAt = new Date();
      // add new user
      global.dbo
        .collection("users")
        .insertOne(userData, async (err, results) => {
          if (err) {
            console.log(err);
            throw new Error(err);
          }
          // new user created, send the email
          // generate the token for the email verification
          let token = uuid();
          let tokenData = {
            email: userData.email,
            token: token,
            type: "email_verification",
          };
          let encodedToken = Buffer.from(JSON.stringify(tokenData)).toString(
            "base64"
          );

          console.log("token ==", encodedToken);
          let emailVerificationData = {
            email: userData.email,
            token: token,
            type: "email_verification",
          };
          // add in the email verification collection
          await addEntryInRedisStore(emailVerificationData);

          // send email
          let emailCopy = {
            type: "account_confirmation_email",
            toAddress: userData.email,
            name: userData.name,
            confirmationLink:
              `${nconf.get("siteDomain")}/email-verification/?token=${encodedToken}`,
          };
          // add email in the Job
          global.emailQueue.add(emailCopy);

          // add the access key in the Redis
          await setAccessKeyInRedis(userData);
          //return data
          let response = null;
          if(results.ops && results.ops[0]) {
            response = results.ops[0];
            if(response.password) {
              delete response.password;
            }
          }
          resolve({
            error: false,
            data: response,
          });
        });
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * @verifyUser
 * @param {*} userData
 */

function verifyUser(userData) {
  return new Promise(async (resolve, reject) => {
    try {
      let userDatafromDb = await checkIfUserExists({ email: userData.email });
      if (userDatafromDb.data && userDatafromDb.data.length > 0) {
        // user already exists, check the user status
        if(userDatafromDb.data[0].accountStatus === 'deactivated') {
          return resolve({
            error: true,
            message: "Account is deactivated, please contact support.",
            data: [],
          });
        }
        // verify the password
        let passwordVerification = await bcrypt.compare(
          userData.password,
          userDatafromDb.data[0].password
        );
        if (!passwordVerification) {
          // password mismatch
          return resolve({
            error: true,
            message: "Invalid email or password",
            data: [],
          });
        }
        // password verified
        let response = null;
        if(userDatafromDb.data && userDatafromDb.data[0]) {
          response = userDatafromDb.data[0];
          if(response.password) {
            delete response.password;
          }
        }
        return resolve({ error: false, data: response });
      } else {
        return resolve({
          error: true,
          message:
            "There is no user exists with this credentials. Please create a new account.",
          data: [],
        });
      }
    } catch (e) {
      console.log(e);
      reject(e);
    }
  });
}

/**
 * @getUserData
 */

function getUserData(userData) {
  return new Promise((resolve, reject) => {
    try {
      global.dbo
        .collection("users")
        .find({ email: userData.email })
        .toArray((err, results) => {
          if (err) {
            console.log(err);
            throw new Error(err);
          }
          if (results.length === 0) {
            return resolve({ error: false, data: [] });
          }
          resolve({ error: false, data: results[0] });
        });
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * @checkIfUserExists
 */

function checkIfUserExists(userData) {
  return new Promise((resolve, reject) => {
    try {
      // check if user exists
      global.dbo
        .collection("users")
        .find({ email: userData.email })
        .toArray((err, results) => {
          if (err) {
            console.log(err);
            throw new Error(err);
          }
          resolve({ error: false, data: results });
        });
    } catch (e) {
      reject(e);
    }
  });
}

function checkLinkVerification(data) {
  return new Promise((resolve, reject) => {
    try {
      // check in redis first
      global.userVerificationStore.get(data.email, async (err, reply) => {
        if (err) {
          throw new Error(err);
        }
        if (reply === null) {
          return resolve({ error: true, data: [] });
        }
        let redisData = JSON.parse(reply);
        // check if tokens matches
        if (redisData.token !== data.token) {
          throw new Error("Token mismatch");
        }
        // data exists, update email flag
        if (redisData.type === "email_verification") {
          await updateEmailVerificationFlag({ email: data.email });
          // delete redis entry after successful verification
          global.userVerificationStore.del(data.email, (err, reply) => {
            if (err) {
              throw new Error(err);
            }
            return resolve({
              error: false,
              data: [],
            });
          });
        }
        // for forgot_password return the response
        return resolve({
          error: false,
          data: [],
        });
      });
    } catch (e) {
      reject(e);
    }
  });
}

function updateEmailVerificationFlag(data) {
  return new Promise((resolve, reject) => {
    try {
      global.dbo
        .collection("users")
        .updateOne(
          { email: data.email },
          { $set: { isEmailVerified: true } },
          (err, results) => {
            if (err) {
              console.log(err);
              throw new Error(err);
            }
            resolve({ error: false, data: results });
          }
        );
    } catch (e) {
      reject(e);
    }
  });
}

function updateApiCount(data) {
    return new Promise((resolve, reject) => {
      try {
        global.dbo
          .collection("users")
          .updateOne(
            { apiKey: data.accessKey },
            { $inc: { apiCount: 1 } },
            (err, results) => {
              if (err) {
                console.log(err);
                throw new Error(err);
              }
              global.redis.set(
                data.accessKey,
                JSON.stringify({accountType: data.accountData.accountType, count: data.accountData.count+1, status: data.accountData.status}),
                (redisError) => {
                  if (redisError) {
                    // some error occurred
                    throw new Error(redisError);
                  }              
                  resolve({ error: false, data: results });
                }
              );              
            }
          );
      } catch (e) {
        reject(e);
      }
    });
  }

function updateForgotPassword(userData) {
  return new Promise(async (resolve, reject) => {
    try {
      let userDatafromDb = await checkIfUserExists({ email: userData.email });
      if (userDatafromDb.data && userDatafromDb.data.length > 0) {
        // user exists, match the password then update it
        let passwordHash = await bcrypt.hash(userData.password, 15);
        global.dbo
          .collection("users")
          .updateOne(
            { email: userData.email },
            { $set: { password: passwordHash } },
            (err, result) => {
              if (err) {
                return resolve({
                  error: true,
                  message:
                    "Error updating your password. please contact support",
                  data: [],
                });
              }
              // password is updated. delete entry from Redis
              global.userVerificationStore.del(userData.email, (err, reply) => {
                if (err) {
                  throw new Error(err);
                }
                return resolve({
                  error: false,
                  message:
                    "Password is updated. Please log-in to account with the new password.",
                  data: [],
                });
              });
            }
          );
      } else {
        return resolve({
          error: true,
          message: "User already exists with this credentials. Please login",
          data: [],
        });
      }
    } catch (e) {}
  });
}

function forgotPassord(userData) {
  return new Promise(async (resolve, reject) => {
    try {
      // check if user exists
      let userDatafromDb = await checkIfUserExists({
        email: userData.email,
      });

      if (userDatafromDb && userDatafromDb.data.length === 0) {
        // user does not exists
        return resolve({ error: true, message: "No such user exists" });
      }
      // user exists, proceed further
      // generate new token and add the entry in the redis
      let token = uuid();
      let tokenData = {
        email: userData.email,
        token: token,
        type: "forgot_password",
      };
      let encodedToken = Buffer.from(JSON.stringify(tokenData)).toString(
        "base64"
      );

      let forgotPasswordData = {
        email: userData.email,
        token: token,
        type: "forgot_password",
      };

      // add into redis store
      await addEntryInRedisStore(forgotPasswordData);

      // send forgot password email
      let emailCopy = {
        type: "forgot_password",
        toAddress: userData.email,
        name: "there",
        forgetPasswordLink:
          `${nconf.get("siteDomain")}/user/reset-password/?token=${encodedToken}`,
      };

      // add email in the Job
      global.emailQueue.add(emailCopy);

      //return data
      resolve({
        error: false,
        data: [],
      });
    } catch (e) {
      reject(e);
    }
  });
}

function setAccessKeyInRedis(data) {
    return new Promise((resolve, reject) => {
        try {
          // add in Redis store
          console.log(data)
          global.redis.set(
            data.apiKey,
            JSON.stringify({accountType: data.accountType, count: 0, status: data.accountStatus}),
            (err) => {
              if (err) {
                // some error occurred
                throw new Error(err);
              }              
              resolve({ error: false, data: [] });
            }
          );
        } catch (e) {
          reject(e);
        }
      });
}

function addEntryInRedisStore(emailData) {
  return new Promise((resolve, reject) => {
    try {
      // add in Redis store
      global.userVerificationStore.set(
        emailData.email,
        JSON.stringify(emailData),
        (err) => {
          if (err) {
            // some error occurred
            throw new Error(e);
          }
          // set expiry after a week
          global.userVerificationStore.expire(emailData.email, 604800);
          resolve({ error: false, data: [] });
        }
      );
    } catch (e) {
      reject(e);
    }
  });
}

function updateExistingPassword(userData) {
  return new Promise(async (resolve, reject) => {
    try {
      let userDatafromDb = await checkIfUserExists({ email: userData.email });
      if (userDatafromDb.data && userDatafromDb.data.length > 0) {
        // user exists, match the password then update it
        // let oldPasswordHash = await bcrypt.hash(userData.oldPassword, 15);
        // console.log("old password => ",oldPasswordHash);
        // console.log("old password => ",userDatafromDb.data[0]);
        // if(oldPasswordHash !== userDatafromDb.data[0].password) {
        //   return resolve({
        //     error: true,
        //     message:
        //       "Error updating password details. Please re-enter the credentials.",
        //     data: [],
        //   });
        // }

        let passwordVerification = await bcrypt.compare(
          userData.oldPassword,
          userDatafromDb.data[0].password
        );
          if (!passwordVerification) {
          // password mismatch
          return resolve({
            error: true,
            message: "Error updating your password. You have entered the wrong credentials.",
            data: [],
          });
        }
        let passwordHash = await bcrypt.hash(userData.currentPassword, 15);
        global.dbo
          .collection("users")
          .updateOne(
            { email: userData.email },
            { $set: { password: passwordHash } },
            (err, result) => {
              if (err) {
                return resolve({
                  error: true,
                  message:
                    "Error updating your password. please contact support",
                  data: [],
                });
              }
              // password is updated.
              return resolve({
                error: false,
                message:
                  "Password is updated. Please log-in to account with the new password.",
                data: [],
              });
            }
          );
      } else {
        return resolve({
          error: true,
          message: "Invalid credentials. Please contact support.",
          data: [],
        });
      }
    } catch (e) {
      reject({
        error: true,
        message: "Invalid credentials. Please contact support.",
        data: [],
      });
    }
  });
}

function deleteUserAccount(userData) {
  return new Promise(async (resolve, reject) => {
    try {
      let userDatafromDb = await checkIfUserExists({ email: userData.email });
      if (userDatafromDb.data && userDatafromDb.data.length > 0) {
        // user exists, remove the user account
        console.log("delete account data => \n", userDatafromDb.data);
        global.dbo
          .collection("users_courses")
          .deleteMany(
            { userId: userDatafromDb.data[0]._id.toString() },
            (err, result) => {
              if (err) {
                return resolve({
                  error: true,
                  message:
                    "Error deleting your account. please contact support",
                  data: [],
                });
              }
              global.dbo.collection("users").deleteOne({_id: userDatafromDb.data[0]._id},(err, result) => {
                if (err) {
                  return resolve({
                    error: true,
                    message:
                      "Error deleting your account. please contact support",
                    data: [],
                  });
                }
                // courses deleted, delete the account
                return resolve({
                  error: false,
                  message:
                    "Account successfully deleted.",
                  data: [],
                });
              });
            }
          );
      } else {
        return resolve({
          error: true,
          message: "Error deleting your account. please contact support",
          data: [],
        });
      }
    } catch (e) {
      reject({
        error: true,
        message: "Error deleting your account. please contact support",
        data: [],
      });
    }
  });
}

module.exports = {
  addUser: addUser,
  getUserData: getUserData,
  verifyUser: verifyUser,
  checkLinkVerification: checkLinkVerification,
  forgotPassord: forgotPassord,
  updateForgotPassword: updateForgotPassword,
  updateExistingPassword: updateExistingPassword,
  deleteUserAccount: deleteUserAccount,
  updateApiCount: updateApiCount,
};