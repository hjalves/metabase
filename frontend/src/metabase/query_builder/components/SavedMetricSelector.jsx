import React, { Component } from "react";
import _ from "underscore";

import LoadingAndErrorWrapper from "metabase/components/LoadingAndErrorWrapper.jsx";
import Icon from "metabase/components/Icon.jsx";
import CheckBox from "metabase/components/CheckBox.jsx";

import cx from "classnames";
import VisualizationResult from "metabase/query_builder/components/VisualizationResult";
import MetricList from "metabase/query_builder/components/MetricList";
import { getDisplayTypeForCard, getQuestionQueryResults} from "metabase/query_builder/actions";

type Props = {
    onClose: () => void,
    originalQuestion: Question,
    // TODO Add correct type for the query result
    results: any
}

export default class SavedMetricSelector extends Component {
    props: Props;

    constructor(props, context) {
        super(props, context);
        const { question, results } = this.props;

        this.state = {
            currentQuestion: question,
            currentResults: results,
            // The initial aggregations are only set when the selector view is opened
            initialMetrics: question.singleQueries(),
            addedMetrics: {},
            searchValue: ""
        };
    }

    onSearchChange = (e) => {
        this.setState({ searchValue: e.target.value.toLowerCase() });
    };

    updateQuestionAndFetchResults = (updatedQuestion) => {
        // TODO: Should we have some kind of loading state here?
        getQuestionQueryResults(updatedQuestion)
            .then((newResults) => {
                // TODO: Should the display type be automatically updated when adding a metric? Probably it should?
                updatedQuestion.setDisplay(getDisplayTypeForCard(updatedQuestion.card(), newResults));

                this.setState({
                    currentQuestion: updatedQuestion,
                    currentResults: newResults
                });
            })
            .catch((error) => {
                this.setState({
                    currentQuestion: updatedQuestion,
                    error
                });
            })
    };

    addMetric = (metricWrapper) => {
        // TODO Maybe don't use global state, maintain local query instead; this code is helpful for that
        const { addedMetrics, currentQuestion } = this.state;

        this.setState({
            addedMetrics: {
                ...addedMetrics,
                [metricWrapper.id]: true
            }
        });

        const updatedQuestion = currentQuestion.addSavedMetric(metricWrapper);
        this.updateQuestionAndFetchResults(updatedQuestion);
    };

    removeMetric = (metricWrapper) => {
        const { addedMetrics, currentQuestion } = this.state;

        const metrics = currentQuestion.singleQueries();
        const index = _.findIndex(metrics, (metric) => metric.equalsToMetric(metricWrapper));

        if (index !== -1) {
            const updatedQuestion = currentQuestion.removeMetric(index);
            this.updateQuestionAndFetchResults(updatedQuestion);
        } else {
            console.error("Removing the metric from aggregations failed");
        }

        this.setState({
            addedMetrics: _.omit(addedMetrics, metricWrapper.id)
        });
    };

    onToggleMetric = (metric, e) => {
        const checked = e.target.checked;

        try {
            if (checked) {
                this.addMetric(metric);
            } else {
                this.removeMetric(metric)
            }

        } catch(e) {
            console.error("onToggleMetric", e);
        }

    };

    onDone = () => {
        const { currentQuestion } = this.state;
        const { onClose, updateQuestion, runQuestionQuery } = this.props;

        onClose();
        // Show the result in normal QB view
        setTimeout(() => {
            updateQuestion(currentQuestion);
            runQuestionQuery({ ignoreCache: true });
        });
    };

    filteredMetrics = () => {
        const { searchValue, initialMetrics, currentQuestion } = this.state;

        if (!currentQuestion) return [];

        return currentQuestion.availableSavedMetrics().filter(metricWrapper => {
            if (_.find(initialMetrics, (metric) => metric.equalsToMetric(metricWrapper))) {
                return false;
            }

            return !(
                searchValue &&
                (metricWrapper.name || "").toLowerCase().indexOf(searchValue) < 0 &&
                (metricWrapper.description || "").toLowerCase().indexOf(searchValue) < 0
            );
        });
    };

    render() {
        const { onClose } = this.props;
        const { currentResults, currentQuestion, addedMetrics } = this.state;

        const filteredMetrics = this.filteredMetrics();
        const error = filteredMetrics.length === 0 ? new Error("Whoops, no compatible metrics match your search.") : null;
        const badMetrics = [];

        const MetricListItem = ({metric}) =>
            <li key={metric.id}
                className={cx("my1 pl2 py1 flex align-center", {disabled: badMetrics[metric.id]})}>
                <span className="px1 flex-no-shrink">
                    <CheckBox checked={addedMetrics[metric.id]}
                              onChange={this.onToggleMetric.bind(this, metric)}/>
                </span>
                <span className="px1">
                    {metric.name}
                </span>
            </li>;

        return (
            <div className="spread flex">
                <div className="flex flex-column flex-full bg-white">
                    <div className="flex-no-shrink h3 pl4 pt4 pb1 text-bold">
                        <MetricList {...this.props} hideAddButton hideClearButton />
                    </div>
                    <div className="flex-full mx1 relative">
                        <VisualizationResult
                            // onUpdateWarnings={(warnings) => this.setState({ warnings })}
                            // onOpenChartSettings={() => this.refs.settings.open()}
                            className="spread pb1"
                            {...this.props}
                            question={currentQuestion}
                            results={currentResults}
                        />
                        {/*{ this.state.state &&*/}
                        {/*<div className="spred flex layout-centered" style={{ backgroundColor: "rgba(255,255,255,0.80)" }}>*/}
                            {/*{ this.state.state === "loading" ?*/}
                                {/*<div className="h3 rounded bordered p3 bg-white shadowed">Applying Metric</div>*/}
                                {/*: null }*/}
                        {/*</div>*/}
                        {/*}*/}
                    </div>
                </div>
                <div className="border-left flex flex-column" style={{width: 370, backgroundColor: "#F8FAFA", borderColor: "#DBE1DF" }}>
                    <div className="flex-no-shrink border-bottom flex flex-row align-center" style={{ borderColor: "#DBE1DF" }}>
                        <Icon className="ml2" name="search" size={16} />
                        <input className="h4 input full pl1" style={{ border: "none", backgroundColor: "transparent" }} type="search" placeholder="Search for a metric" onFocus={this.onSearchFocus} onChange={this.onSearchChange}/>
                    </div>
                    <LoadingAndErrorWrapper className="flex flex-full" loading={!filteredMetrics} error={error} noBackground>
                        { () =>
                            <ul className="flex-full scroll-y scroll-show pr1">
                                {filteredMetrics.map(m => <MetricListItem metric={m} />)}
                            </ul>
                        }
                    </LoadingAndErrorWrapper>
                    <div className="flex-no-shrink pr2 pb2 pt1 flex border-top" style={{ borderColor: "#DBE1DF" }}>
                        <div className="flex-full">{/* TODO: How to implement a full-width border-top without this extra component? */}</div>
                        <button data-metabase-event={"Dashboard;Edit Series Modal;cancel"} className="Button Button--borderless" onClick={onClose}>Cancel</button>
                        <button className="Button Button--primary" onClick={this.onDone}>Done</button>
                    </div>
                </div>
            </div>
        );
    }
}