# Symfony ECS App for bradlatham.com

This is a php Symfony App that runs on ECS and infrastructure is setup by AWS CDK. The app also offers local testing with docker compose to visualize changes.

This was done with a tutroial provided on [medium](https://medium.com/wiiisdom-labs/build-and-deploy-a-symfony-application-on-aws-using-cdk-ecs-and-rds-ec8c85465af6) and has it's own repo on [github](https://github.com/wiiisdom/symfony-cdk-example)


## Local testing

Local testing of changes can be done with docker compose. as long as you have docker and docker compose installed you can pull the repo down, run `docker-compose up --build` in the root directory of the project, and go to `localhost:8000` to view

## Useful commands

 * `npm run build`   compile typescript to js
 * `npm run watch`   watch for changes and compile
 * `npm run test`    perform the jest unit tests
 * `cdk deploy`      deploy this stack to your default AWS account/region
 * `cdk diff`        compare deployed stack with current state
 * `cdk synth`       emits the synthesized CloudFormation template
