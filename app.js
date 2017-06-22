'use strict';

const express                     = require('express');
const expressValidator            = require('express-validator');
const app                         = express();
const bodyParser                  = require('body-parser');
const {
  SafeRouter
} = require('./index.js');


function log() {
  if(true) {
    return console.log(...arguments);
  }
}

const expressValidatorOptions = {

  customSanitizers: {
    digitsOnly: function(value, replacement = '') {
      // Remove anything non-digit with replacement
      return value.replace(/\D+/g, replacement);
    },
  },

  customValidators: {

    isFoo: (value) => {
      log(`Is ${value} foo?`);
      return value === 'foo';
    },
    isBar: (value) => {
      log(`Is ${value} bar?`);
      return value === 'bar';
    },
    isBaz: (value) => {
      log(`Is ${value} baz?`);
      return true;
      return value === 'baz';
    },
    isSearch: value => {
      log(`Is ${value} trump?`);
      return value === 'trump';
    }
  }
};

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
// Express-Validator should be used just after BodyParser!
app.use(expressValidator(expressValidatorOptions));


const safeRouterConfig = {

  // stripUnencounteredParams: false,

  complete: (req, res, next) => {

    req.getValidationResult()
      .then(result => {
        // SEE IF THERE ARE ERRORS
        if (!result.isEmpty()) {

          // REPORT THE FIRST ERROR ONLY
          result.useFirstErrorOnly();

          // GET THE ERRORS
          let errors = result.array();

          // LET IT FLY
          return res.status(200).json(errors);
        }

        log('Validation was good? Calling next');
        return next();
      })
      .catch(next);
  }
};
const safeRouter = SafeRouter({}, safeRouterConfig);



const validations = {
  foo: (key, isOptional, req, res, next) => {
    log(`Checking: ${key}; optional: ${isOptional}`);
    req.check(key, 'It is not foo.').isFoo();
  },

  bar: (key, isOptional, req, res, next) => {
    log(`Checking: ${key}; optional: ${isOptional}`);
    req.check(key, 'It is not foo.').isBar();
  },

  baz: (key, isOptional, req, res, next) => {
    log(`Checking: ${key}; optional: ${isOptional}`);
    req.sanitize(key).digitsOnly();
    req.check(key, 'It is not foo.').isBaz();
  },

  search: (key, isOptional, req, res, next) => {
    req.check(key, 'It is not search.').isSearch();
  },
};


safeRouter.get('/:foo/:bar/:baz',
  {
    preValitizeMiddlewares: [
      (req, res, next) => {
        log('adding req.body.poo = blouse');
        req.body.poo = 'blouse';
        return next();
      }
    ],
    required: {
      foo:    validations.foo,
      bar:    validations.bar,
      baz:    validations.baz,
      search: validations.search
    }
  },

  // OKIE DOKIE
  (req, res, next) => {
    console.log('MAKE IT!');
    console.log('req.params', req.params);
    console.log('req.body', req.body);
    res.json({
      message: 'This is it, you made it!',
      params: req.params,
      body: req.body,
      query: req.query
    }
    );
  }
);

app.use(safeRouter);

console.log('ready');
module.exports = app;