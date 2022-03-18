#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { SymfonyAppStack } from '../lib/symfony-app-stack';

const app = new cdk.App();
new SymfonyAppStack(app, "SymfonyAppDevStack", {
  
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
  
  dev: true,
})