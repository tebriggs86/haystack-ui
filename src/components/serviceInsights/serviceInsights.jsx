/*
 * Copyright 2019 Expedia Group
 *
 *       Licensed under the Apache License, Version 2.0 (the "License");
 *       you may not use this file except in compliance with the License.
 *       You may obtain a copy of the License at
 *
 *           http://www.apache.org/licenses/LICENSE-2.0
 *
 *       Unless required by applicable law or agreed to in writing, software
 *       distributed under the License is distributed on an "AS IS" BASIS,
 *       WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *       See the License for the specific language governing permissions and
 *       limitations under the License.
 *
 */

import React, {Component} from 'react';
import {observer} from 'mobx-react';
import Loading from '../common/loading';
import Error from '../common/error';
import timeWindow from '../../utils/timeWindow';
import PropTypes from 'prop-types';
import Summary from './summary';
import ServiceInsightsGraph from './serviceInsightsGraph/serviceInsightsGraph';
import './serviceInsights.less';

@observer
export default class ServiceInsights extends Component {
    static propTypes = {
        search: PropTypes.object.isRequired,
        store: PropTypes.object.isRequired
    };

    componentDidMount() {
        if (this.hasValidSearchProps()) {
            this.getServiceInsight();
        }
    }

    hasValidSearchProps = () => this.props.search.serviceName;

    getServiceInsight = () => {
        const search = this.props.search;
        const timePresetOptions = window.haystackUiConfig.tracesTimePresetOptions;
        const isCustomTimeRange = !!(search.time && search.time.from && search.time.to);

        let activeWindow;

        if (isCustomTimeRange) {
            activeWindow = timeWindow.toCustomTimeRange(search.time.from, search.time.to);
        } else if (search.time && search.time.preset) {
            activeWindow = timePresetOptions.find((preset) => preset.shortName === search.time.preset);
        } else {
            activeWindow = timeWindow.defaultPreset;
        }

        const activeWindowTimeRange = timeWindow.toTimeRange(activeWindow.value);

        const queryParams = {
            service: search.serviceName,
            from: activeWindowTimeRange.from,
            to: activeWindowTimeRange.until
        };

        // Get service insights
        this.props.store.fetchServiceInsights(queryParams);
    };

    render() {
        const {store} = this.props;

        return (
            <section className="container serviceInsights">
                {!this.hasValidSearchProps() && (
                    <p className="select-service-msg">
                        Please search for a serviceName in the global search bar to render a service insight (such as serviceName=example-service).
                    </p>
                )}

                {this.hasValidSearchProps() &&
                    store.promiseState &&
                    store.promiseState.case({
                        pending: () => <Loading className="service-insights__loading" />,
                        rejected: () => <Error />,
                        fulfilled: () => {
                            const data = store.serviceInsights;

                            if (data && data.nodes && data.nodes.length) {
                                return (
                                    <div className="row">
                                        <Summary data={data.summary} />
                                        <ServiceInsightsGraph graphData={data} />
                                    </div>
                                );
                            }

                            return <Error errorMessage="No trace data found" />;
                        }
                    })}
            </section>
        );
    }
}
