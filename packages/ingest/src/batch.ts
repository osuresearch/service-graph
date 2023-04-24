import { Handler, SQSEvent } from 'aws-lambda';

export const handler: Handler = async (event: SQSEvent, context) => {
  console.log('EVENT: \n' + JSON.stringify(event, null, 2));

  event.Records.forEach((record) => {
    console.log('Record', record);
  });

  return context.logStreamName;
};
