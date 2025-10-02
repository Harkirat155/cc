module.exports = {
  apps: [
    {
      name: "myapp",
      script: "npm",
      args: "run server",
      cwd: "/var/www/myapp",
      env: {
        NODE_ENV: "production",
      },
      env_file: ".env", // optional: load additional env vars from .env file
    },
  ],
};