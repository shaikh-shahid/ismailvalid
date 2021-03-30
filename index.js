const express = require("express");
const session = require("express-session");
const redisStore = require("connect-redis")(session);
const nconf = require("nconf");
const helmet = require('helmet');
const path = require('path');
const bodyParser = require("body-parser");
const cors = require("cors");
const { createLogger, format, transports } = require("winston");
const app = express();

// load config file
nconf
  .argv()
  .env()
  .file({
    file: __dirname + "/config.json",
  });

  // connect to MongoDB and Redis database
require("./models/connect");

  // session middleware configuration
app.use(
  session({
    secret: nconf.get("sessionSecret"),
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
    },
    store: new redisStore({ client: global.sessionStore }),
    resave: false,
    saveUninitialized: false,
  })
);

app.set("views", path.join(__dirname, "views"));
app.engine('html', require('ejs').renderFile);
app.set("view engine", "ejs");

  const logger = createLogger({
    level: "debug",
    format: format.simple(),
    transports: [
      new transports.File({ filename: __dirname + '/logs/error.log', level: 'error' }),
      new transports.File({ filename: __dirname + '/logs/access.log' })
    ],
  });

  if(nconf.get('environment') === 'production') {
    console.log = (...args) => {
      logger.info(...args);
    };
  
    console.error = (...args) => {
      logger.error(...args);
    };
  }

  // security and shit
//  app.use(helmet());

  // set cross origin requests
app.use(cors());

// disable some headers
app.disable("etag");
app.disable("x-powered-by");

// require bodyparser
app.use(bodyParser.json());
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

app.use('/api', require('./routes/verify'));
app.use('/', require('./routes/static'));
app.use('/account', require('./routes/account'));
app.use('/users', require('./routes/users'));

// 404
app.use(function (req, res, next) {
  res.status(404).render("404");
});

// error handling routes
app.use((err, req, res, next) => {
  res.status(500).send("Server Error \n" + JSON.stringify(err));
});

app.listen(nconf.get('port'), () => {
  console.log(`Server is running at ${nconf.get('port')}`);
});