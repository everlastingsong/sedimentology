module.exports = {
  apps : [
    {
      name: "dispatcher",
      script: "./build/command/dispatcher.js",
      args: "--mariadb-database whirlpool -i 5",
      env: {
        NODE_ENV: "production",
      }
    },
    {
      name: "sequencer",
      script: "./build/command/sequencer.js",
      args: "--mariadb-database whirlpool --solana-rpc-url http://localhost:8899 -n 100",
      env: {
        NODE_ENV: "production",
      }
    },
    {
      name: "processor-1",
      script: "./build/command/processor.js",
      args: "--mariadb-database whirlpool --solana-rpc-url http://localhost:8899 -c 10",
      env: {
        NODE_ENV: "production",
      }
    },
    {
      name: "processor-2",
      script: "./build/command/processor.js",
      args: "--mariadb-database whirlpool --solana-rpc-url http://localhost:8899 -c 10",
      env: {
        NODE_ENV: "production",
      }
    },
  ],
};
