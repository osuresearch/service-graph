
# Common commands

Build packages: `yarn build`

Clean build artifacts (dist, d.ts files, etc): `yarn clean`

Deploy dev copy to AWS: `yarn deploy:dev`. 

Note that your CDK install needs to already be authenticated for deployment. Verify this with: `aws sts get-caller-identity`
