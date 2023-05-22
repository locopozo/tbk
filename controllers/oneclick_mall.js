const asyncHandler = require("../utils/async_handler");
const Oneclick = require("transbank-sdk").Oneclick;
const TransactionDetail = require("transbank-sdk").TransactionDetail;
const IntegrationCommerceCodes = require("transbank-sdk").IntegrationCommerceCodes;


const { LocalStorage } = require('node-localstorage');

// Initialize a local storage instance
const localStorage = new LocalStorage('./localStorage');

/*
localStorage.setItem('key', 'value');

const item = localStorage.getItem('key');
console.log(item); // Output: value
*/

console.log('Versión de Node.js:', process.version);

const mysql = require('mysql')

const conexion = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'tbk'
})

conexion.connect(error => {
  if (error){

     console.log('Problemas de conexion con mysql');  

  } else {

     console.log('conexión establecida!!');  

  }

})


var username2;
var	tbkUser2;
var buyOrder2;
var amount2;


exports.start = asyncHandler(async (request, response, next) => {

  const nombreTarjeta = request.params.nombre;
  const emailTarjeta = request.params.email;
  const montoTarjeta = request.params.monto;

  localStorage.setItem('email', emailTarjeta);

  let randomNumber = Math.floor(Math.random() * 100000) + 1;

  console.log(nombreTarjeta);
  console.log(emailTarjeta);
  console.log(montoTarjeta);

 // let email = "user." + randomNumber + "@example.cl";
  let responseUrl =
    request.protocol + "://" + request.get("host") + "/oneclick_mall/finish";

  const startResponse = await (new Oneclick.MallInscription()).start(
    nombreTarjeta,
    emailTarjeta,
    responseUrl
  );

  let viewDataStart = {
    montoTarjeta,
    nombreTarjeta,
    emailTarjeta,
    responseUrl,
    startResponse,
  };

  console.log(viewDataStart.startResponse.token);

    const registro = {

   
      nombre: nombreTarjeta,

      email: emailTarjeta,

     // tbk_user: viewData.startResponse.details[0].authorization_code,

      monto: montoTarjeta,

    }


    conexion.query('insert into usuarios set ?', registro, (error, resultado) => {
      if (error) {
        console.log(error)
        
      }
    })




  response.render("oneclick_mall/start", {
    step: "Comenzar inscripción",
    stepDescription:
      "En este paso comenzaremos la inscripción para poder en el siguiente paso " +
      "redirigir al Tarjetahabiente hacia el formulario de inscripción de Oneclick",
    viewDataStart,
  });
});



exports.finish = asyncHandler(async (request, response, next) => {

  let params = request.method === 'GET' ? request.query : request.body;

  let token = params.TBK_TOKEN;
  let tbkOrdenCompra = params.TBK_ORDEN_COMPRA;
  let tbkIdSesion = params.TBK_ID_SESION;
	
  if (tbkOrdenCompra == null){
    const finishResponse = await (new Oneclick.MallInscription()).finish(token);
    let viewData = {
      token,
      finishResponse,
    };



  conexion.query('UPDATE usuarios SET tbk_user = ? WHERE email = ?',[viewData.finishResponse.tbk_user,localStorage.getItem('email')],(error, results) => {
    if (error) {
      console.error('Error executing MySQL query: ', error);
    } else {

      console.log('type: ', viewData.finishResponse.card_type);
      console.log('number: ', viewData.finishResponse.card_number);

    }
  });




    response.render("oneclick_mall/finish", {
      step: "Finalizar inscripción",
      stepDescription:
        "En este paso terminaremos la inscripción, para luego poder hacer cargos " +
        "cargos a la tarjeta que el tarjetahabiente inscriba.",
      viewData,
    });
  }
  else{
    let viewData = {
      token,
      tbkOrdenCompra,
      tbkIdSesion
    };

    response.render("oneclick_mall/finish-error", {
      step: "La inscripción fue anulada por el usuario",
      stepDescription:
        "En este paso abandonamos la inscripción al haber presionado la opción 'Abandonar y volver al comercio'",
      viewData,
    });
  }

});



exports.authorize = asyncHandler(async (request, response, next) => {

  const amount = request.body.amount;
  console.log(amount);

  const username = request.body.username;
  console.log(username);

  const tbkUser = request.body.tbk_user;
  console.log(tbkUser);

  const buyOrder = "O-" + Math.floor(Math.random() * 10000) + 1;
  const childBuyOrder = "O-" + Math.floor(Math.random() * 10000) + 1;

 // let amount = Math.floor(Math.random() * 1000) + 1001;

  let childCommerceCode = IntegrationCommerceCodes.ONECLICK_MALL_CHILD1;

  const details = [
    new TransactionDetail(amount, childCommerceCode, childBuyOrder),
  ];

  const authorizeResponse = await (new Oneclick.MallTransaction()).authorize(
    username,
    tbkUser,
    buyOrder,
    details
  );

  let viewData = {
    username,
    tbkUser,
    buyOrder,
    childCommerceCode,
    amount,
    childBuyOrder,
    details,
    authorizeResponse,
  };



    const registro = {

      //amount: viewData.amount,
      amount: authorizeResponse.details[0].amount,

      status: viewData.authorizeResponse.details[0].status,

      authorization_code: viewData.authorizeResponse.details[0].authorization_code,

      payment_type_code: viewData.authorizeResponse.details[0].payment_type_code,

      response_code: viewData.authorizeResponse.details[0].response_code,

      installments_number: viewData.authorizeResponse.details[0].installments_number,

      commerce_code: viewData.authorizeResponse.details[0].commerce_code,

      child_buy_order: viewData.authorizeResponse.details[0].buy_order,

      buy_order:  viewData.authorizeResponse.buy_order,         

      card_number:  viewData.authorizeResponse.card_detail.card_number,

      accounting_date:  viewData.authorizeResponse.accounting_date, 

      transaction_date:  viewData.authorizeResponse.transaction_date,

      username: viewData.username,

      tbkUser: tbkUser,         
 

    }


    conexion.query('insert into transacciones set ?', registro, (error, resultado) => {
      if (error) {
        console.log(error)
        
      }
    })






  response.render("oneclick_mall/authorize", {
    viewData,
  });
});

exports.delete = asyncHandler(async (request, response, next) => {
  const username = request.body.username;
  const tbkUser = request.body.tbk_user;
  await (new Oneclick.MallInscription()).delete(tbkUser, username);
  
  let viewData = {
    username,
    tbkUser
  };

  response.render("oneclick_mall/delete", {
    step: "Eliminar inscripción",
    stepDescription:
      "En este paso eliminaremos la inscripción.",
    viewData,
  });
});

exports.status = asyncHandler(async (request, response, next) => {
  const buyOrder = request.body.buy_order;

  const statusResponse = await (new Oneclick.MallTransaction()).status(buyOrder);

  let viewData = {
    buyOrder,
    statusResponse,
  };

  response.render("oneclick_mall/status", {
    step: "Estado de transacción",
    stepDescription:
      "Con esta operación podemos solicitar el estado de una transacción",
    viewData,
  });
});

exports.refund = asyncHandler(async (request, response, next) => {
  const buyOrder = request.body.buy_order;
  const childCommerceCode = request.body.commerce_code;
  const childBuyOrder = request.body.child_buy_order;
  const amount = request.body.amount;

  const refundResponse = await (new Oneclick.MallTransaction()).refund(
    buyOrder,
    childCommerceCode,
    childBuyOrder,
    amount
  );

  let viewData = {
    refundResponse,
    buyOrder,
    amount,
  };

const tableName = 'transacciones'; // Your table name
const fieldToUpdate = 'status'; // The field you want to update
const newValue = viewData.refundResponse.type; // The new value for the field
const condition = 'child_buy_order='+viewData.refundResponse.buy_order; // E.g., 'id = 1' or 'name = "John"'

  conexion.query('UPDATE transacciones SET status = ? WHERE child_buy_order = ?',[viewData.refundResponse.type,viewData.refundResponse.buy_order],(error, results) => {
    if (error) {
      console.error('Error executing MySQL query: ', error);
    } else {

      console.error('type: ', viewData.refundResponse.type);
      console.error('buy order: ', viewData.refundResponse.buy_order);

    }
  });





  response.render("oneclick_mall/refund", {
     viewData
  });
});



exports.tools = asyncHandler(async (request, response, next) => {


  conexion.query('SELECT * FROM usuarios', (error, results) => {
    if (error) {
      console.error('Error executing MySQL query: ', error);
    } else {
       response.render("oneclick_mall/tools", {

         data: results

       });
    }
  });


});



exports.transacciones = asyncHandler(async (request, response, next) => {

    const userId = request.params.id;
    const nombreUsuario = request.params.nombre;

    conexion.query('SELECT * FROM transacciones WHERE idUsuario = ?',[userId],(error, results) => {
      if (error) {
        console.error('Error executing MySQL query: ', error);
      } else {
         response.render("oneclick_mall/transacciones", {

           data: results,
           nombreUsuario,
           userId

         });
      }
    });


});

exports.cargado = asyncHandler(async (request, response, next) => {

    const userId = request.params.id;
    //const username = request.params.nombre;
   // const amount = request.params.monto;


  	console.log(userId);



    conexion.query('SELECT * FROM usuarios WHERE id = ?',[userId],(error, results) => {

      if (error) {

        console.error('Error executing MySQL query: ', error);


      } else {
  
      	 amount2 = results[0].monto;
      	 tbkUser2 = results[0].tbk_user;
      	 username2 = results[0].nombre;

      	console.log('amount ---> '+amount2);
      	console.log('tbkUser ---> '+tbkUser2);
      	console.log('username ---> '+username2);



      }


    });




      	const buyOrder = "O-" + Math.floor(Math.random() * 10000) + 1;
  		const childBuyOrder = "O-" + Math.floor(Math.random() * 10000) + 1;

  		let childCommerceCode = IntegrationCommerceCodes.ONECLICK_MALL_CHILD1;

		  const details = [
		    new TransactionDetail(amount2, childCommerceCode, childBuyOrder),
		  ];

		  const authorizeResponse = await (new Oneclick.MallTransaction()).authorize(
		    username2,
		    tbkUser2,
		    buyOrder,
		    details
		  );

		  let viewData = {
		    username2,
		    tbkUse2r,
		    buyOrder,
		    childCommerceCode,
		    amount2,
		    childBuyOrder,
		    details,
		    authorizeResponse,
		  };







		response.render("oneclick_mall/cargado", {

           data: results,
           username,
           userId,
           amount,
           viewData

        });
  





});

/*

  const amount = request.params.;
  console.log(amount);

  const username = request.params.username;
  console.log(username);

  const buyOrder = "O-" + Math.floor(Math.random() * 10000) + 1;
  const childBuyOrder = "O-" + Math.floor(Math.random() * 10000) + 1;

 // let amount = Math.floor(Math.random() * 1000) + 1001;

  let childCommerceCode = IntegrationCommerceCodes.ONECLICK_MALL_CHILD1;

  const details = [
    new TransactionDetail(amount, childCommerceCode, childBuyOrder),
  ];

  const authorizeResponse = await (new Oneclick.MallTransaction()).authorize(
    username,
    tbkUser,
    buyOrder,
    details
  );

  let viewData = {
    username,
    tbkUser,
    buyOrder,
    childCommerceCode,
    amount,
    childBuyOrder,
    details,
    authorizeResponse,
  };

*/

