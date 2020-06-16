module.exports = {
    apps: [{
      name: "app",
      script: "./server.js",
      env: {
        NODE_ENV: "development"
      },
      env_staging: {
        NODE_ENV: "staging",
      },
      env_production: {
        NODE_ENV: "production",
        MONGO_ATLAS_PW: "SyYbAwkhCzoW77jM",
        MONGO_ATLAS_DB: "node-shop",
        JWT_KEY: "secret"
      }
    }]
  }