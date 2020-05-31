import * as pulumi from '@pulumi/pulumi'
import * as aws from '@pulumi/aws'
import * as awsx from '@pulumi/awsx'

const config = new pulumi.Config()

const group = new aws.ec2.SecurityGroup('app-security', {
  description: 'Enable HTTP and SSH access',
  ingress: [
    {
      protocol: 'tcp',
      fromPort: 8080,
      toPort: 8080,
      cidrBlocks: ['0.0.0.0/0'],
    },
    { protocol: 'tcp', fromPort: 22, toPort: 22, cidrBlocks: ['0.0.0.0/0'] },
  ],
  egress: [
    { protocol: '-1', fromPort: 0, toPort: 0, cidrBlocks: ['0.0.0.0/0'] },
  ],
})

const createAgetUserData = (name: string, token: string) =>
  `#!/bin/bash
su ubuntu -c 'whoami;
cd home/ubuntu;
mkdir agent && cd agent;
curl -O -L https://github.com/actions/runner/releases/download/v2.262.1/actions-runner-linux-x64-2.262.1.tar.gz;
ls
tar xzf ./actions-runner-linux-x64-2.262.1.tar.gz;
ls
./config.sh --url https://github.com/kdichev/ec2-pulumi-agents --token AC52MGNGBKQCXFYPIGSPUUK62KMQM --unattended;
ls
sudo ./svc.sh install;
sudo ./svc.sh start;'`

const createInstance = (
  name: string,
  size: pulumi.Input<aws.ec2.InstanceType>
) =>
  new aws.ec2.Instance(name, {
    tags: { Name: name },
    instanceType: size,
    vpcSecurityGroupIds: [group.id], // reference the group object above
    ami: 'ami-085925f297f89fce1',
    userData: createAgetUserData(name, 'AC52MGNFTGSGEZIYZXACBNC62KHF2'), // start a simple web server
    keyName: 'test-key',
  })

// Create ad AWS resource (EC2 Instance)
const agentOne = createInstance('agents-1', 't2.micro')

// Create an AWS resource (S3 Bucket)
const bucket = new aws.s3.Bucket('my-bucket')

function publicReadPolicyForBucket(bucketName: string) {
  return JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: '*',
        Action: ['s3:GetObject'],
        Resource: [
          `arn:aws:s3:::${bucketName}/*`, // policy refers to bucket name explicitly
        ],
      },
    ],
  })
}

// Set the access policy for the bucket so all objects are readable
let bucketPolicy = new aws.s3.BucketPolicy('bucketPolicy', {
  bucket: bucket.bucket, // depends on siteBucket -- see explanation below
  policy: bucket.bucket.apply(publicReadPolicyForBucket),
  // transform the siteBucket.bucket output property -- see explanation below
})

export const bucketName = bucket.id
export const websiteUrl = bucket.websiteEndpoint // output the endpoint as a stack output
