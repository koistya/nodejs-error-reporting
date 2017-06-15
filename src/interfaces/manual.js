/**
 * Copyright 2016 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';
var is = require('is');
var isString = is.string;
var isObject = is.object;
var isFunction = is.fn;
var ErrorMessage = require('../classes/error-message.js');
var manualRequestInformationExtractor =
    require('../request-extractors/manual.js');
var populateErrorMessage = require('../populate-error-message.js');

/**
 * The handler setup function serves to produce a bound instance of the
 * reportManualError function with no bound context, a bound first arugment
 * which is intended to be an initialized instance of the API client and a bound
 * second argument which is the environmental configuration.
 * @function handlerSetup
 * @param {AuthClient} client - an initialized API client
 * @param {NormalizedConfigurationVariables} config - the environmental
 *  configuration
 * @param {Object} logger - The logger instance created when the library API has
 *  been initialized.
 * @returns {reportManualError} - a bound version of the reportManualError
 *  function
 */
function handlerSetup(client, config, logger) {
  /**
   * The interface for manually reporting errors to the Google Error API in
   * application code.
   * @param {Any|ErrorMessage} err - error information of any type or content.
   *  This can be of any type but by giving an instance of ErrorMessage as the
   *  error arugment one can manually provide values to all fields of the
   *  potential payload.
   * @param {Object} [request] - an object containing request information. This
   *  is expected to be an object similar to the Node/Express request object.
   * @param {String} [additionalMessage] - a string containing error message
   *  information to override the builtin message given by an Error/Exception
   * @param {Function} [callback] - a callback to be invoked once the message
   *  has been successfully submitted to the error reporting API or has failed
   *  after four attempts with the success or error response.
   * @returns {ErrorMessage} - returns the error message created through with
   * the parameters given.
   */
  function reportManualError(err, request, additionalMessage, callback) {
    var em;
    if (isString(request)) {
      // no request given
      callback = additionalMessage;
      additionalMessage = request;
      request = undefined;
    } else if (isFunction(request)) {
      // neither request nor additionalMessage given
      callback = request;
      request = undefined;
      additionalMessage = undefined;
    }

    if (isFunction(additionalMessage)) {
      callback = additionalMessage;
      additionalMessage = undefined;
    }

    if (err instanceof ErrorMessage) {
      // The API expects the error to contain a stack trace.  Thus we
      // append the stack trace of the point where the error was constructed.
      // See the `message-builder.js` file for more details.
      if (err._autoGeneratedStackTrace) {
        err.setMessage(err.message + '\n' + err._autoGeneratedStackTrace);
        // Delete the property so that if the ErrorMessage is reported a second
        // time, the stack trace is not appended a second time.  Also, the API
        // will not accept the ErrorMessage if it has additional properties.
        delete err._autoGeneratedStackTrace;
      } else {
        logger.warn('Encountered a manually constructed error with message \"'+
                    err.message + '\" but without a construction site ' +
                    'stack trace.  This error might not be visible in the ' +
                    'error reporting console.');
      }
      em = err;
    } else {
      em = new ErrorMessage();
      em.setServiceContext(config.getServiceContext().service,
                          config.getServiceContext().version);
      populateErrorMessage(err, em);
    }

    if (isObject(request)) {
      em.consumeRequestInformation(manualRequestInformationExtractor(request));
    }

    if (isString(additionalMessage)) {
      em.setMessage(additionalMessage);
    }

    client.sendError(em, callback);
    return em;
  }

  return reportManualError;
}

module.exports = handlerSetup;
