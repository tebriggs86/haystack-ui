/*
 * Copyright 2018 Expedia Group
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

import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'mobx-react';
import {Route, BrowserRouter as Router} from 'react-router-dom';
import Main from './main';
import storesInitializer from './stores/storesInitializer';
import withTracker from './components/common/withTracker';
import serviceGraphStore from './components/serviceGraph/stores/serviceGraphStore';

// app initializers
storesInitializer.init();

const stores = {
    graphStore: serviceGraphStore
};

// mount react components
ReactDOM.render(
    <Provider {...stores}>
        <Router>
            <Route component={withTracker(Main)}/>
        </Router>
    </Provider>
    , document.getElementById('root')
);
