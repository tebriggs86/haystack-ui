/* eslint-disable no-param-reassign */
/*
 * Copyright 2019 Expedia Group
 *
 *         Licensed under the Apache License, Version 2.0 (the "License");
 *         you may not use this file except in compliance with the License.
 *         You may obtain a copy of the License at
 *
 *             http://www.apache.org/licenses/LICENSE-2.0
 *
 *         Unless required by applicable law or agreed to in writing, software
 *         distributed under the License is distributed on an "AS IS" BASIS,
 *         WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *         See the License for the specific language governing permissions and
 *         limitations under the License.
 */

const {type} = require('./enums');
const {detectCycles} = require('./detectCycles');
const {edge, gateway, mesh, database, outbound, service} = require('../../config/config').connectors.serviceInsights.spanTypes;

/**
 * createNode()
 * Function to create a graph node and enforce data schema for creating a node
 * @param {object} data
 */
function createNode(data) {
    // Sanity check required properties
    ['id', 'name'].forEach((requiredProperty) => {
        /* istanbul ignore if -- this is to identify misconfiguration during development */
        if (typeof data[requiredProperty] === 'undefined') {
            throw new Error(`Missing required property ${requiredProperty} when calling createNode()`);
        }
    });
    return {
        count: 1,
        ...data
    };
}

/**
 * createLink()
 * Function to create a graph edge and enforce data schema for creating a edge
 * @param {object} data
 */
function createLink(data) {
    // Sanity check required properties
    ['source', 'target'].forEach((requiredProperty) => {
        /* istanbul ignore if -- this is to identify misconfiguration during development */
        if (typeof data[requiredProperty] === 'undefined') {
            throw new Error(`Missing required property ${requiredProperty} when calling createLink()`);
        }
    });
    return {
        isUninstrumented: false,
        count: 1,
        tps: 1,
        ...data
    };
}

/**
 * getNodeNameFromSpan()
 * Gets the display name given a span object
 * @param {object} span - Haystack span object
 */
function getNodeNameFromSpan(span) {
    if (edge && edge.isType(span)) {
        return edge.nodeName(span);
    }
    if (gateway && gateway.isType(span)) {
        return gateway.nodeName(span);
    }
    if (mesh && mesh.isType(span)) {
        return mesh.nodeName(span);
    }
    if (database && database.isType(span)) {
        return database.nodeName(span);
    }
    if (outbound && outbound.isType(span)) {
        return outbound.nodeName(span);
    }
    /* istanbul ignore else -- required configuration */
    if (service) {
        return service.nodeName(span);
    }
    /* istanbul ignore next */
    throw new Error('Missing required configuration: connectors.serviceInsights.spanTypes.service');
}

/**
 * getNodeIdFromSpan()
 * Gets the unique id given a span object, considering when to treat spans as the same node or separate
 * @param {object} span - Haystack span object
 */
function getNodeIdFromSpan(span) {
    if (edge && edge.isType(span)) {
        return edge.nodeId(span);
    }
    if (gateway && gateway.isType(span)) {
        return gateway.nodeId(span);
    }
    if (mesh && mesh.isType(span)) {
        return mesh.nodeId(span);
    }
    if (database && database.isType(span)) {
        return database.nodeId(span);
    }
    if (outbound && outbound.isType(span)) {
        return outbound.nodeId(span);
    }
    /* istanbul ignore else -- required configuration */
    if (service) {
        return service.nodeId(span);
    }
    /* istanbul ignore next */
    throw new Error('Missing required configuration: connectors.serviceInsights.spanTypes.service');
}

/**
 * processNodesAndLinks()
 * Process nodes and links
 * @param {string} serviceName - Name of central dependency
 * @param {Map} nodes - Map of nodes
 * @param {Map} links - Map of links
 * @returns {object}
 */
function processNodesAndLinks(serviceName, nodes, links) {
    // Marks nodes and links with invalid DAG cyces
    const cyclesFound = detectCycles({nodes, links});

    // Store unique traces to calculate how many traces were considered
    const uniqueTraces = new Set();

    // Store count of uninstrumented
    let uninstrumentedCount = 0;

    // Process Links
    links.forEach((link) => {
        // NOTE: here source means source side of the link, not necessarily source end of the graph
        const source = nodes.get(link.source);
        const target = nodes.get(link.target);

        // Process invalid DAG cycle
        if (source.invalidCycleDetected === true && target.invalidCycleDetected === true) {
            link.invalidCycleDetected = true;
            link.invalidCyclePath = source.invalidCyclePath;
        }

        // Node on the source side of the link is not a leaf
        source.isLeaf = false;
    });

    // Process nodes
    nodes.forEach((node) => {
        // Process Central Node
        if (node.serviceName === serviceName && node.type !== type.outbound) {
            node.isCentral = true;
        }

        // Detect unique traces
        node.traceIds.forEach((traceId) => {
            uniqueTraces.add(traceId);
        });

        // Nodes not explicitly not a leaf (see above) are leaves
        if (!(node.isLeaf === false)) {
            node.isLeaf = true;
        }

        // Check if un-instrumented
        if (node.isLeaf && node.type === type.mesh) {
            uninstrumentedCount++;

            // Create uninstrumented node and add it to the map
            const uninstrumentedNode = createNode({
                ...node,
                id: `${node.id}-missing-trace`,
                name: 'Uninstrumented Service',
                serviceName: 'unknown',
                type: type.uninstrumented
            });
            nodes.set(uninstrumentedNode.id, uninstrumentedNode);

            // Create link to uninstrumented node
            const linkId = `${node.id}→${uninstrumentedNode.id}`;
            links.set(
                linkId,
                createLink({
                    source: node.id,
                    target: uninstrumentedNode.id,
                    isUninstrumented: true
                })
            );
        }

        // Check if uninstrumented client span
        if (node.isLeaf && node.type === type.outbound) {
            node.type = type.uninstrumented;
            uninstrumentedCount++;
        }
    });

    // Define map of violations
    const violations = {};

    // Summarize cycle violations
    if (cyclesFound > 0) {
        violations.cycles = cyclesFound;
    }

    // Summarize unique count of uninstrumented dependencies
    if (uninstrumentedCount > 0) {
        violations.uninstrumented = uninstrumentedCount;
    }

    // Summarize if any types of violations found
    const hasViolations = Object.keys(violations).length > 0;

    return {
        violations,
        hasViolations,
        tracesConsidered: uniqueTraces.size
    };
}

/**
 * buildNodes()
 * Builds a map of nodes.
 * @param {Array<span>} spans - Array of fully hydrated Haystack spans
 */
function buildNodes(spans) {
    const nodes = new Map();

    spans.forEach((span) => {
        const nodeId = getNodeIdFromSpan(span);
        const nodeName = getNodeNameFromSpan(span);

        const node = createNode({
            id: nodeId,
            name: nodeName,
            serviceName: span.serviceName,
            duration: span.duration,
            operations: {[`${span.operationName}`]: 1},
            traceIds: [span.traceId]
        });

        if (edge && edge.isType(span)) {
            node.type = type.edge;
        } else if (gateway && gateway.isType(span)) {
            node.type = type.gateway;
        } else if (mesh && mesh.isType(span)) {
            node.type = type.mesh;
        } else if (database && database.isType(span)) {
            node.type = type.database;
            node.databaseType = database.databaseType(span);
        } else if (outbound && outbound.isType(span)) {
            node.type = type.outbound;
        } else {
            node.type = type.service;
        }

        const currentNode = nodes.get(nodeId);

        // If new node, set
        if (!currentNode) {
            nodes.set(node.id, node);
        } else {
            // Else, update operation
            currentNode.operations[span.operationName] = currentNode.operations[span.operationName]
                ? currentNode.operations[span.operationName] + 1
                : 1;
            currentNode.count++;
            currentNode.duration += span.duration;
            currentNode.avgDuration = `${Math.floor(currentNode.duration / currentNode.count / 1000)} ms`;
            currentNode.traceIds.push(span.traceId);
        }
    });
    return nodes;
}

/**
 * buildLinks()
 * Builds a map of links.
 * @param {*} spans
 */
function buildLinks(spans) {
    const linkMap = new Map(); // linkId: link
    const spansById = new Map(); // spanId: span

    spans.forEach((span) => {
        spansById.set(span.spanId, span);
    });

    spans.forEach((span) => {
        const parentSpanId = span.parentSpanId;
        if (parentSpanId) {
            const parentSpan = spansById.get(parentSpanId);
            if (parentSpan) {
                const parentNodeId = getNodeIdFromSpan(parentSpan);
                const childNodeId = getNodeIdFromSpan(span);
                const linkId = `${parentNodeId}→${childNodeId}`;
                if (parentNodeId !== childNodeId) {
                    const currentLink = linkMap.get(linkId);
                    // If link does not exist in map, create it
                    if (!currentLink) {
                        linkMap.set(
                            linkId,
                            createLink({
                                source: parentNodeId,
                                target: childNodeId
                            })
                        );
                    } else {
                        // else, calculate magnitude
                        currentLink.count++;
                        currentLink.tps++;
                    }
                }
            }
        }
    });

    return linkMap;
}

/**
 * extractNodesAndLinks()
 * Given an array of spans and a service name, perform transform to build a nodes + links structure from multiple traces
 * @param {*} spans - Array of fully hydrated span objects related to multiple traces
 * @param {*} serviceName - Service name to search for
 */
const extractNodesAndLinks = ({spans, serviceName}) => {
    // build map of nodes
    const nodes = buildNodes(spans);

    // build map of links
    const links = buildLinks(spans);

    // Process nodes and links for consumption of graphing library
    const summary = processNodesAndLinks(serviceName, nodes, links);

    return {
        summary,
        nodes: [...nodes.values()],
        links: [...links.values()]
    };
};

module.exports = {
    extractNodesAndLinks
};
