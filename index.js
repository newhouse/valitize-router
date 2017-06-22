'use strict';


const _       = require('lodash');
const methods = require('methods');

const checkLocations = [
  'query', // CHECK THE QUERY STRING 1st
  'params', // CHECK THE URL PARAMETERS 2nd
  'body' // CHECK THE BODY 3rd
];

let defaultExpress;
// const defaultRouter = defaultExpress.Router;

function log() {
  if(true) {
    return console.log(...arguments);
  }
}



function SafeRouter(routerOptions, config) {

  _.defaults(config, {
    stripUnencounteredParams: true
  });

  if(!config.complete) {
    throw new Error('No \'complete\' function provided in config.');
  }
  if(typeof config.complete !== 'function') {
    throw new Error('config.complete must be a function.');
  }

  // STORE THE ROUTER INSTANCE HERE
  let router;

  //*********************************************
  //
  // MAKE A ROUTER INSTANCE
  //
  // IF A ROUTER INSTANCE IS PASSED, USE THAT
  if (config.router) {
    router = config.router;
  }
  else {
    // DEFAULT THE OPTIONS AS WE ARE GOING TO BE USING THEM
    routerOptions = routerOptions || {};

    // OK, MUST CREATE A NEW ROUTER INSTANCE

    // STORE THE ROUTER FACTORY HERE
    let Router;

    // IF ROUTER FACTORY WAS PASSED, USE THAT
    if (config.Router) {
      Router = config.Router;
    }

    // IF EXPRESS WAS PASSED, USE ITS ROUTER FACTORY
    else if (config.express) {
      Router = config.express.Router;
    }

    // USE DEFAULT EXPRESS ROUTER FACTORY
    else {
      // IF WE HAVE NOT ALREADY LOADED DEFAULT EXPRESS, LET'S LOAD IT
      if (!defaultExpress) {
        defaultExpress = require('express');
      }
      // ROUTER FACTORY WILL BE DEFAULT EXPRESS ROUTER FACTORY
      Router = defaultExpress.Router;
    }

    // CREATE A NEW ROUTER OBJECT/INSTANCE
    router = Router(routerOptions);
  }
  //
  //*********************************************


  return generateRouterProxy(router, config);
}


function generateRouterProxy(router, config) {
  return new Proxy(router, {

    // HANDLE GETTING OF ALL THE METHOD FUNCTIONS
    get (target, propKey) {

      // IF THIS IS NOT AN ASK FOR ONE OF THE HTTP METHOD VERBS, THEN IT IS NOT A ROUTE REGISTRATION
      // AND WE CAN JUST RETURN THE NATURAL THING
      if (!_.includes(methods, propKey)) {
        return target[propKey];
      }

      return handleRouteRegistration(target, propKey, config);
    }
  });
}



// HANDLE A ROUTE REGISTRATION
function handleRouteRegistration(router, propKey, config) {

  // RETURN A FUNCTION
  return function() {

    // CONVERT THE ARGUMENTS INTO AN ARRAY
    let args = Array.prototype.slice.call(arguments);

    let preValitizeMiddlewares;

    // IF THE 2ND ARGUMENT IS AN OBJECT, WE CAN ASSUME IT'S A VALITIZE RULES OBJECT
    if (_.isPlainObject(args[1])) {

      // EXTRACT OUT THE RULES
      let rules = args[1];

      // IF ANY PRE-VALITIZE MIDDLEWARES WERE PASSED
      if (rules.preValitizeMiddlewares) {
        // PLUCK THEM OUT AND REMOVE THEM FROM THE ARGUMENTS
        preValitizeMiddlewares = rules.preValitizeMiddlewares;
        _.unset(rules, 'preValitizeMiddlewares');
      }

      // REPLACE THE ARGUMENT AT POSITION 1 WITH VALITIZE MIDDLEWARE
      // SO THAT PARAMETERS ARE CHECKED!
      args[1] = valitize(rules, config);
    }
    else {
      // Otherwise, dev forgot to include a Valitize rules object, so let's insert a Valitize
      // middleware at the front of the middleware chains, and pass it an empty object which
      // will blank out all params.

      // DEV MUST HAVE FORGOTTEN TO PASS ANY RULES
      args.splice(1, 0, valitize({}, config));
    }

    // IF ANY PRE-VALITIZE MIDDLEWARES WERE PROVIDED
    if (preValitizeMiddlewares && preValitizeMiddlewares.length > 0) {

      // PUT THEM IN THE FRONT OF THE REST OF THE MIDDLEWARES THAT WERE PROVIDED
      args.splice(1, 0, ...preValitizeMiddlewares);
    }

    // MAKE THE CALL TO THE UNDERLYING ROUTER, USING THE MODIFIED ARGUMENTS
    return router[propKey].apply(this, args);

  };
}



function valitize(rules, config) {

  // RETURN A MIDDLEWARE
  return function(req, res, next) {

    let checkType = 'check';

    const keysEncountered = applyValidations(rules, req, res, next, checkType);

    if (config.stripUnencounteredParams === true) {
      stripUnencounteredParams(checkType, req, keysEncountered);
    }

    // CALL THE PROVIDED getValidationResult CALLBACK
    return config.complete(req, res, next);

  };
}


function applyValidations(rules, req, res, next, checkType) {
  const keysEncountered = [];

  let optionalities = ['required', 'optional'];

  optionalities.forEach(optionality => {
    log('processing', optionality, 'rules');

    let isOptional = optionality !== 'required';

    log('isOptional', isOptional);

    const theseRules = rules[optionality];

    // FOR EVERY PARAM KEY IN THESE RULES
    for(let paramKey in theseRules) {

      log(`appliying ${paramKey}`);

      // CALL THE FUNCTION
      theseRules[paramKey](paramKey, isOptional, req, res, next);

      keysEncountered.push(paramKey);
    }
  });


  return keysEncountered;
}




function stripUnencounteredParams(checkType, req, keysEncountered) {

  log('Stripping unencoutered params', checkType, keysEncountered);

  switch(checkType) {

    case 'check':
      // STRIP OUT ANY PARAMS WE DIDN'T ENCOUNTER
      _.forEach(checkLocations, location => {
        stripTheseUnencounteredParams(req, location, keysEncountered);
      });
      break;

    default:
      console.warn(`Unsupported checkType supplied: ${checkType}.`);
      console.warn('Stripping all params from request object.');
      _.forEach(checkLocations, location => {
        req[location] = {};
      });
      break;
  }
}

function stripTheseUnencounteredParams(req, location, keysEncountered) {
  return req[location] = _.pick(req[location], keysEncountered);
}










module.exports = {
  SafeRouter: SafeRouter
};



















