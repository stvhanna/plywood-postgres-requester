/*
 * Copyright 2015-2016 Imply Data, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/// <reference path="../typings/requester.d.ts" />
/// <reference path="../typings/locator.d.ts" />

import * as Q from 'q';
import * as pg from "pg";
import * as pgTypes from "pg-types";
import * as parseDateUTC from 'postgres-date-utc';

pgTypes.setTypeParser(1700, pgTypes.getTypeParser(700)); // numeric same as double
pgTypes.setTypeParser(20, pgTypes.getTypeParser(21)); // big int same as int
pgTypes.setTypeParser(1082, parseDateUTC); // date
pgTypes.setTypeParser(1114, parseDateUTC); // timestamp without timezone
pgTypes.setTypeParser(1184, parseDateUTC); // timestamp
// ToDo: fix date array also

export interface PostgresRequesterParameters {
  locator?: Locator.PlywoodLocator;
  host?: string;
  user: string;
  password: string;
  database: string;
}

function basicLocator(host: string): Locator.PlywoodLocator {
  var hostnamePort = host.split(':');
  var hostname: string;
  var port: number;
  if (hostnamePort.length > 1) {
    hostname = hostnamePort[0];
    port = Number(hostnamePort[1]);
  } else {
    hostname = hostnamePort[0];
    port = 5432;
  }
  return () => {
    return Q({
      hostname: hostname,
      port: port
    });
  };
}

export function postgresRequesterFactory(parameters: PostgresRequesterParameters): Requester.PlywoodRequester<string> {
  var locator = parameters.locator;
  if (!locator) {
    var host = parameters.host;
    if (!host) throw new Error("must have a `host` or a `locator`");
    locator = basicLocator(host);
  }
  var user = parameters.user;
  var password = parameters.password;
  var database = parameters.database;

  return (request): Q.Promise<any[]> => {
    var query = request.query;
    return locator()
      .then((location) => {
        var client = new pg.Client({
          host: location.hostname,
          port: location.port || 5432,
          database: database,
          user: user,
          password: password,

          parseInputDatesAsUTC: true // not in the type
        } as any);

        client.on('drain', client.end.bind(client)); //disconnect client when all queries are finished
        client.connect();

        var deferred = <Q.Deferred<any[]>>(Q.defer());

        //query is executed once connection is established and PostgreSQL server is ready for a query
        client.query(query, function(err, result) {
          if (err) {
            deferred.reject(err);
          } else {
            deferred.resolve(result.rows);
          }
        });

        return deferred.promise;
      });
  };
}
