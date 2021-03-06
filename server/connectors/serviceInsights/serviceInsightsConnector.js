/*
 * Copyright 2019 Expedia Group
 *
 *         Licensed under the Apache License, Version 2.0 (the 'License');
 *         you may not use this file except in compliance with the License.
 *         You may obtain a copy of the License at
 *
 *             http://www.apache.org/licenses/LICENSE-2.0
 *
 *         Unless required by applicable law or agreed to in writing, software
 *         distributed under the License is distributed on an 'AS IS' BASIS,
 *         WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *         See the License for the specific language governing permissions and
 *         limitations under the License.
 */

const Q = require('q');

const fetcher = require('./fetcher');
const extractor = require('./graphDataExtractor');

const connector = {};

function fetchServiceInsights(serviceName, from, to) {
    return fetcher(serviceName)
        .fetch(serviceName, from, to)
        .then((data) => extractor.extractNodesAndLinks(data));
}

connector.getServiceInsightsForService = (serviceName, from, to) => Q.fcall(() => fetchServiceInsights(serviceName, from, to));

module.exports = connector;
