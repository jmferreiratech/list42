# list42-backend

## Deploy

Every push to `main` that touches `backend/**` runs `.github/workflows/deploy-backend.yml`, which runs `serverless deploy` (stage `v1`, region `us-east-1`). It can also be started by hand from the Actions tab.

Configuration lives in SSM Parameter Store under `/list42/<stage>/` and is resolved at deploy time into the Lambdas' environment variables.

### One-time setup

**1. SSM parameters**

```sh
STAGE=v1
aws ssm put-parameter --name /list42/$STAGE/LOG_LEVEL            --type String       --value info
aws ssm put-parameter --name /list42/$STAGE/ORIGINS              --type String       --value 'https://example.github.io'
aws ssm put-parameter --name /list42/$STAGE/BETTER_AUTH_SECRET   --type SecureString --value '...'
aws ssm put-parameter --name /list42/$STAGE/GOOGLE_CLIENT_ID     --type SecureString --value '...'
aws ssm put-parameter --name /list42/$STAGE/GOOGLE_CLIENT_SECRET --type SecureString --value '...'
aws ssm put-parameter --name /list42/$STAGE/JWT_SECRET           --type SecureString --value '...'
```

Use `--overwrite` to change a value. A change only reaches the Lambdas on the next deploy.

**2. GitHub OIDC provider and deploy role**

```sh
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

aws iam create-open-id-connect-provider \
    --url https://token.actions.githubusercontent.com \
    --client-id-list sts.amazonaws.com

cat > trust.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"Federated": "arn:aws:iam::$ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"},
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": {
        "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
        "token.actions.githubusercontent.com:sub": "repo:jmferreiratech/list42:ref:refs/heads/main"
      }
    }
  }]
}
EOF

aws iam create-role --role-name list42-github-deploy --assume-role-policy-document file://trust.json
aws iam attach-role-policy --role-name list42-github-deploy \
    --policy-arn arn:aws:iam::aws:policy/AdministratorAccess
rm trust.json
```

Skip `create-open-id-connect-provider` if the account already has one for GitHub. Only workflows running on `main` can assume the role.

**3. GitHub variable**

```sh
gh variable set AWS_DEPLOY_ROLE_ARN --repo jmferreiratech/list42 \
    --body "arn:aws:iam::$ACCOUNT_ID:role/list42-github-deploy"
```
