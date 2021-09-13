'use strict';
const {uuid } = require('uuidv4');
const AWS = require('aws-sdk');
const sqs = new AWS.SQS({ region: process.env.REGION });
const QUEUE_URL = process.env.PENDING_ORDER_QUEUE;
const orderMetadataManager = require('./orderMetadataManager');


module.exports.hacerPedido = async (event) => {
  console.log('Iniciando el proceso de pedido');
  const body = JSON.parse(event.body);

  const order = {
    orderId: uuid(),
    name: body.name,
    address: body.address,
    pizzas: body.pizzas,
    timestamp: Date.now()
  };

  try{
    const params = {
      MessageBody: JSON.stringify(order),
      QueueUrl:  QUEUE_URL
    };
    const sqsResponse = await sqs.sendMessage(params).promise();    
    console.log(`La respuesta es: ${sqsResponse.MessageId}`);

    return {
      statusCode: 200,
      body: JSON.stringify(
        {
          order: order,
          messageId: sqsResponse.MessageId
        },
        null,
        2
      ),
    };

  }catch(error){
    console.log(error);
  }
};

module.exports.prepararPedido = async (event) => {
  console.log('Iniciando preparación de pedido');
  const order = JSON.parse(event.Records[0].body);
  await orderMetadataManager
    .saveCompletedOrder(order).then(() => {
      console.log(`Registro almacenado correctamente con id ${order.orderId}`);
    }).catch(error => {
      console.log(`Error en dynomo ${error}`);
    });
  console.log(`Finalización de proceso de pedido`);  
}

module.exports.enviarPedido = async (event) => {
  console.log('Iniciando el proceso - Enviar pedido');
  const record = event.Records[0];
  if(record.eventName === 'INSERT') {
    console.log('deliverOrder');
    const orderId = record.dynamodb.Keys.orderId.S;
    console.log(orderId);
    await orderMetadataManager.deliverOrder(orderId).then(data => {
      console.log(data);
    }).catch(error => {
      console.log(error);
    });
  }else{
    console.log('Is not a new record');    
  }
}

module.exports.estadoPedido = async (event) => {
	const orderId = event.pathParameters && event.pathParameters.orderId;
  let status = '';
  await orderMetadataManager.getOrder(orderId).then(order =>{
    status = `El estado de la orden: ${order.orderId} es ${order.deliveryStatus}`
  });
  return {    
    statusCode: 200,
    body: JSON.stringify(
      {
        status: status
      },
      null,
      2
    ),
  };  
};