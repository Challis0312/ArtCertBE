const {
    SecretsManagerClient,
    GetSecretValueCommand,
  } = require( "@aws-sdk/client-secrets-manager");

const { aws_region } = require('../config');

async function getAWSsecret(secretName) {
    //configure AWS SDK
    
    try {
      const client = new SecretsManagerClient({
        region: aws_region,
      });
      
      const data = await client.send(
            new GetSecretValueCommand({
              SecretId: secretName,
              VersionStage: "AWSCURRENT", // VersionStage defaults to AWSCURRENT if unspecified
            })
          );
        if (data.SecretString) {
            return JSON.parse(data.SecretString);
        } else {
            throw new Error('SecretString is empty');
        }
    } catch (error) {
        console.error('Error fetching secret:', error);
        throw error;
    }
}


module.exports = {getAWSsecret};