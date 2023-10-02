module.exports = {
  apps : [
    {
      name: "dispatcher",
      script: "./build/command/dispatcher.js",
      args: "--mariadb-database localtest0 -i 5",
      env: {
        NODE_ENV: "production",
      }
    },
    {
      name: "sequencer",
      script: "./build/command/sequencer.js",
      args: "--mariadb-database localtest0",
      env: {
        NODE_ENV: "production",
      }
    },
    {
      name: "processor",
      script: "./build/command/processor.js",
      args: "--mariadb-database localtest0 -c 10",
      env: {
        NODE_ENV: "production",
      }
    },
  ],
};
