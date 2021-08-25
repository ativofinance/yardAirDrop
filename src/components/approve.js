import React from 'react';
import { inject, observer } from "mobx-react";
import { Transaction } from "./Transaction"

@inject("UiStore")
@observer
export class ApproveStep extends React.Component {
  constructor(props){
    super(props);
    this.props = props
    this.txStore = props.UiStore.txStore;
    this.explorerUrl = props.UiStore.web3Store.explorerUrl;
    this.intervalId = null
    this.state = {
      txs: this.txStore.txs,
    }

    this.props.addNextHandler(this.onNext)
  }
  componentDidMount(){
    (async () => {
      try {
        await this.txStore.doApprove()
        this.setState({txs: this.txStore.txs})
      } catch(e){
        console.log('doApprove error:', e)
      }
    })()
    if (null === this.intervalId) {
      this.intervalId = setInterval(() => {
        this.setState({txs: this.txStore.txs})
      }, 1000)
    }
  }

  componentWillUnmount() {
    if (null !== this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  onNext = async (wizard) => {
    // console.log(wizard.step)
    if ("approve" !== wizard.step.id) {
      return
    }

    wizard.push("inspect")
  }

  render () {
    const { txs } = this.state
    const txHashes = txs.map((tx, index) => {
      return <Transaction key={index} tx={{...tx}} explorerUrl={this.explorerUrl}/>
    })
    const mined = txs.reduce((mined, tx) => {
      const { status } = tx
      return mined && status === "mined"
    }, true)
    let status;
    if(txs.length > 0){
      if (mined) {
        status =  "Approve transaction is mined. Press the Next button to continue"
      } else {
        status = "Approve transaction was sent out. Now wait until it is mined"
      }
    } else {
      status = `Waiting for you to sign an Approve transaction in Metamask`
    }
    return (
      <div>
        <div>
          <div className="description">
            <div>
              Sign an Approve transaction in MetaMask<br />to send tokens to many recipients from the Multisend smart contract
            </div>
            <p>&nbsp;</p>
            <ol>
              <li>Confirm Approve transaction in MetaMask</li>
              <li>Wait for the transaction to be mined</li>
              <li>Press the <strong>Next</strong> button</li>
            </ol>
          </div>
          <form className="form">
            <p>{status}</p>
            <div className="table">
              {txHashes}
            </div>
          </form>
        </div>
      </div>
    );
  }
}
