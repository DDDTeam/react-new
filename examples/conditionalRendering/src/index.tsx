import {Component, render} from "ddd-react";

class Test extends Component<{}, { test: boolean }> {
    state = {
        test: false,
    };

    didMount() {
        setInterval(() => {
            this.setState({ test: !this.state.test });
        }, 1000);
    }

    render() {
        if (this.state.test) {
            return this.props.children;
        }

        return null;
    }
}

class App1 extends Component {
    render() {
        return (
            <div>
                <Test>
                    333
                </Test>
                <h3>asdf</h3>
            </div>
        );
    }
}

render(
    <App1 />,
    document.body,
);
