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
      name: "backfill",
      script: "./build/command/backfill.js",
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
    {
      name: "replayer",
      script: "./rust_worker/target/release/sedimentology-replayer",
      args: "--mariadb-database whirlpool",
      env: {
        NODE_ENV: "production",
      }
    },
    {
      name: "archiver-r2",
      script: "./rust_worker/target/release/sedimentology-archiver",
      args: "--mariadb-database whirlpool --profile=R2 --rclone-remote-path=./rust_worker/tmp/dst --working-directory=./rust_worker/tmp",
      env: {
        NODE_ENV: "production",
      }
    },
  ],
};
