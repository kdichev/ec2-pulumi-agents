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
sudo mkdir agent && cd agent;
sudo curl -O -L https://github.com/actions/runner/releases/download/v2.262.1/actions-runner-linux-x64-2.262.1.tar.gz;
ls
sudo tar xzf ./actions-runner-linux-x64-2.262.1.tar.gz;
ls
sudo ./config.sh --url https://github.com/kdichev/ec2-pulumi-agents --token AC52MGKGKUPQJMCX536M3CC62KLR2 --unattended;
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

// Export the name of the bucket
export const bucketName = bucket.id
