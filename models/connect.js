const mongo = require("mongodb");
const nconf = require("nconf");
const chalk = require("chalk");
const bull = require("bull");
const redisClient = require("redis").createClient;
global.redis = redisClient(6379, "localhost", { db: 0 });
global.sessionStore = redisClient(6379, "localhost", { db: 1 });
global.userVerificationStore = redisClient(6379, "localhost", { db: 2 });
global.emailQueue = new bull("emailQueue", {
  redis: { port: 6379, host: "localhost", db: 3 },
});

// connect to MongoDB
global.dbo = null;
mongo.connect(
  nconf.get("mongodbURL"),
  {
    useNewUrlParser: true,
  },
  (err, db) => {
    if (err) {
      console.log(chalk.red(err));
      process.exit(0);
    }
    global.dbo = db.db("ismailvalid");
    console.log(
      `${chalk.green("✓")} Connected to ${chalk.green("MongoDB")} database`
    );
  }
);

// check Redis connection
global.redis.on("connect", () => {
  console.log(
    `${chalk.green("✓")} Connected to ${chalk.green("Redis")} database`
  );
});

// check Redis Session store connection
global.sessionStore.on("connect", () => {
  console.log(
    `${chalk.green("✓")} Connected to ${chalk.green("Redis session store")}.`
  );
});

global.userVerificationStore.on("connect", () => {
  console.log(
    `${chalk.green("✓")} Connected to ${chalk.green(
      "user verification redis store"
    )}.`
  );
});