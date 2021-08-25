import React, { Component } from 'react';
import { Header, FirstStep, SecondStep, ThirdStep, ApproveStep, FourthStep, FifthStep, Retry, Welcome } from './components';
import { Route, Redirect } from 'react-router-dom';
import { TransitionGroup, CSSTransition } from 'react-transition-group';
import { inject } from "mobx-react";
import './assets/stylesheets/application.css';
import Navigation from './components/Navigation';
import { Wizard, Steps, Step } from 'react-albus';
import { Line } from 'rc-progress';
import { PulseLoader } from 'react-spinners';


// const RoutedWizard = ({ children }) =>
//   <Route
//     render={({ history, match: { url } }) =>
//       <Wizard history={history} basename={url}>
//         {children}
//       </Wizard>}
//   />;

// const PrivateRoute = ({ component: Component, startedUrl, ...rest }) => (
//   <Route
//     {...rest}
//     render={props =>
//       startedUrl === '#/' || startedUrl === '#/1' ? (
//         <Component {...props} />
//       ) : (
//         <Redirect
//           to={{
//             pathname: "/"
//           }}
//         />
//       )
//     }
//   />
// );

@inject("UiStore")
export class App extends React.Component {
  constructor(props) {
    super(props);
    this.tokenStore = props.UiStore.tokenStore;
    this.web3Store = props.UiStore.web3Store;
    this.nextHandlers = []
    this.state = {
      loading: this.web3Store.loading,
    }
  }

  componentDidMount() {
    (async () => {
      try {
        await this.tokenStore.proxyMultiSenderAddress()
        this.setState((state, props) => {
          return { loading: this.web3Store.loading }
        })
      } catch (ex) {
        console.log("App:", ex)
      }
    })()
  }

  onNext = (wizard) => {
    (async () => {
      try {
        this.nextHandlers.forEach(async handler => {
          await handler(wizard)
        })
      } catch (ex) {
        console.log("onNext:", ex)
      }
    })()
  }

  addNextHandler = (handler) => {
    this.nextHandlers.push(handler)
  }

  render() {
    const { startedUrl } = this.web3Store;
    if (!(startedUrl === '#/' || startedUrl === '#/home')) {
      this.web3Store.setStartedUrl('#/')
      return (
        <Redirect
          to={{
            pathname: "/"
          }}
        />
      )
    }

    return (
      <div>
        <Header />
        <Route
          render={({ history }) => (
            <Wizard
              history={history}
              onNext={this.onNext}
              render={({ step, steps }) => (
                <div className="multisend-container multisend-container_bg">
                  <div className="content">
                    <h1 className="title"><strong>Welcome to YARD</strong> AirDrop Tool</h1>
                    <Line
                      percent={(steps.indexOf(step) + 1) / steps.length * 100}
                      className="pad-b"
                    />
                    <div className='sweet-loading'>
                      <PulseLoader
                        color={'#123abc'}
                        loading={this.state.loading}
                      />
                    </div>
                    <TransitionGroup>
                      <CSSTransition
                        key={step.id}
                        classNames="multisend"
                        timeout={{ enter: 500, exit: 500 }}
                      >
                        <Steps key={step.id} step={step}>
                          <Step id="home">
                            <FirstStep addNextHandler={this.addNextHandler} />
                          </Step>
                          <Step id="inspect">
                            <ThirdStep addNextHandler={this.addNextHandler} />
                          </Step>
                          <Step id="approve">
                            <ApproveStep addNextHandler={this.addNextHandler} />
                          </Step>
                          <Step id="multisend">
                            <FourthStep addNextHandler={this.addNextHandler} />
                          </Step>
                        </Steps>
                      </CSSTransition>
                    </TransitionGroup>
                    <Navigation />
                  </div>
                </div>
              )}
            />
          )}
        />
      </div>
    )
  }
}
