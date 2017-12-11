/*
 * Copyright 2017 Expedia, Inc.
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

import React from 'react';
import {observer} from 'mobx-react';
import PropTypes from 'prop-types';

import Loading from '../../common/loading';
import TrendResultsTable from './trendResultsTable';
import './trendResults.less';
import Error from '../../common/error';


@observer
export default class TrendResults extends React.Component {
    static propTypes = {
        trendResultsStore: PropTypes.object.isRequired,
        location: PropTypes.object.isRequired,
        serviceName: PropTypes.string.isRequired
    };

    render() {
        return (
            <section className="trend-results">
                <div className="results-table-heading">Operations</div>
                { this.props.trendResultsStore.summaryPromiseState && this.props.trendResultsStore.summaryPromiseState.case({
                    empty: () => <Loading />,
                    pending: () => <Loading />,
                    rejected: () => <Error />,
                    fulfilled: () => ((this.props.trendResultsStore.summaryResults && this.props.trendResultsStore.summaryResults.length)
                        ? <TrendResultsTable
                            trendsSearchStore={this.props.trendResultsStore}
                            location={this.props.location}
                            serviceName={this.props.serviceName}
                        />
                        : <Error />)
                })
                }
            </section>
        );
    }
}

