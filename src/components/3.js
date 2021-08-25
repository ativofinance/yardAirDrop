import React from 'react';
import { inject, observer } from "mobx-react";
import BN from 'bignumber.js'
import Web3Utils from 'web3-utils'
import swal from 'sweetalert';
import Select from 'react-select';
import Form from 'react-validation/build/form';

import DataTable, { createTheme } from 'react-data-table-component'

createTheme('solarized', {
  text: {
    primary: '#fff',
    secondary: 'rgb(156, 216, 255)',
    fontFamily: "monospace",
  },
  background: {
    default: 'rgba(255,255,255,0)',
  },
  context: {
    background: 'rgba(255,255,255,1)',
    text: '#FFFFFF',
  },
  divider: {
    default: '#073642',
  },
  button: {
    default: 'rgba(156, 216, 255, 1)',
    focus: 'rgba(156, 216, 255,.8)',
    hover: 'rgba(156, 216, 255,.8)',
    disabled: 'rgba(156, 216, 255, .5)',
  },
  sortFocus: {
    default: 'rgba(156, 216, 255, .54)',
  },
});

const RecipientsDataTable = (props) => {
  const columns = [
    {
      name: 'Address',
      selector: 'address',
      sortable: true,
      grow: 3.8,
    },
    {
      name: 'Amount, ' + props.tokenSymbol,
      selector: 'balance',
      sortable: true,
      left: true,
    },
  ]

  const customStyles = {
    pagination: {
      style: {
        marginBottom: '20px',
      },
    },
    cells: {
      style: {
        fontFamily: "monospace",
      },
    },
  }

  return (
    <DataTable
      title="List of recipients"
      columns={columns}
      theme="solarized"
      customStyles={customStyles}
      pagination
      paginationPerPage={10}
      data={props.data}
      paginationTotalRows={props.data.length}
    />
  )
}

@inject("UiStore")
@observer
export class ThirdStep extends React.Component {
  constructor(props) {
    super(props);
    this.tokenStore = props.UiStore.tokenStore;
    this.txStore = props.UiStore.txStore;
    this.gasPriceStore = props.UiStore.gasPriceStore;
    console.log(this.gasPriceStore.gasPricesArray)
    this.state = {
      gasPrice: '',
      transferGas: 0,
      approveGas: 0,
      multisendGas: 0,
    }
    this.gasSharesArray = [
      { label: '10%', value: '10' },
      { label: '20%', value: '20' },
      { label: '50%', value: '50' },
      { label: '70%', value: '70' },
      { label: '100%', value: '100' },
    ]

    this.props.addNextHandler(this.onNext)
  }
  componentDidMount() {
    if (this.tokenStore.dublicates.length > 0) {

      swal({
        title: `There were duplicated eth addresses in your list.`,
        text: `${JSON.stringify(this.tokenStore.dublicates.slice(), null, '\n')}.\n Multisender already combined the balances for those addreses. Please make sure it did the calculation correctly.`,
        icon: "warning",
      })
    }
    (async () => {
      try {
        const transferGas = await this.txStore.getTransferGas({ slice: this.tokenStore.totalNumberTx, addPerTx: this.tokenStore.arrayLimit })
        this.setState({ transferGas })
        if ("0x000000000000000000000000000000000000bEEF" === this.tokenStore.tokenAddress) {
          // Ether
          const multisendGasOrig = await this.txStore.getMultisendGas({ slice: this.tokenStore.totalNumberTx, addPerTx: this.tokenStore.arrayLimit })
          // Gas Limit: 84,279
          // Gas Used by Transaction: 82,164 (97.49%)
          const multisendGas = Math.floor(parseInt(multisendGasOrig) * 0.975)
          this.setState({ multisendGas })
          this.updateCurrentFee()
        } else {
          if (parseFloat(this.tokenStore.allowance) >= (parseFloat(this.tokenStore.totalBalance))) {
            const multisendGasOrig = await this.txStore.getMultisendGas({ slice: this.tokenStore.totalNumberTx, addPerTx: this.tokenStore.arrayLimit })
            // Gas Limit: 116,153
            // Gas Used by Transaction: 81,933 (70.54%) for ERC20
            // Gas Limit: 170,018
            // Gas Used by Transaction: 135,628 (79.77%) for ERC777 // TODO: detect token type
            const multisendGas = Math.floor(parseInt(multisendGasOrig) * 0.71)
            const approveGas = await this.txStore.getApproveTxGas()
            this.setState({ multisendGas, approveGas })
            this.updateCurrentFee()
          } else {
            const approveGasOrig = await this.txStore.getApproveGas()
            // Gas Limit: 66,181
            // Gas Used by Transaction: 44,121 (66.67%)
            const approveGas = Math.floor(parseInt(approveGasOrig) * 0.6667)
            this.setState({ approveGas })
          }
        }
      } catch (ex) {
        console.log("3:", ex)
      }
    })()
  }

  updateCurrentFee() {
    const id = setTimeout(() => {
      clearTimeout(id)
      this._updateCurrentFeeImpl()
    }, 0)
  }

  _updateCurrentFeeImpl() {
    const { multisendGas, approveGas, transferGas } = this.state
    const gasPrice = this.gasPriceStore.standardInHex
    const approvePlusMultisendGas = (new BN(multisendGas)).plus(new BN(approveGas))
    if (approvePlusMultisendGas.gt(new BN(transferGas))) {
      // no savings
      this.tokenStore.setCurrentFee('0')
      return
    }
    const savedGas = (new BN(transferGas)).minus(approvePlusMultisendGas)
    const savedGasEthValue = new BN(gasPrice).times(savedGas)
    const savedGasPerTxEthValue = savedGasEthValue.div(this.tokenStore.totalNumberTx)
    const newCurrentFee = savedGasPerTxEthValue.times(new BN(parseInt(this.gasPriceStore.selectedGasShare))).div(100)
    const newCurrentFeeRounded = newCurrentFee.dp(0, 1)
    this.tokenStore.setCurrentFee(newCurrentFeeRounded.toString(10))
  }

  onNext = async (wizard) => {
    // console.log(wizard.step)
    if ("inspect" !== wizard.step.id) {
      return
    }

    try {
      if (new BN(this.tokenStore.totalBalance).gt(new BN(this.tokenStore.defAccTokenBalance))) {
        console.error('Your balance is less than total to send')
        swal({
          title: "Insufficient token balance",
          text: `You don't have enough tokens to send to all addresses.\nAmount needed: ${this.tokenStore.totalBalance} ${this.tokenStore.tokenSymbol}`,
          icon: "error",
        })
        return
      }
      const multisendGasEthValue = this.getMultisendPlusApproveGasEthValue()
      const ethBalanceWei = Web3Utils.toWei(this.tokenStore.ethBalance, 'ether');
      if (multisendGasEthValue.gt(new BN(ethBalanceWei))) {
        const displayMultisendGasEthValue = parseFloat(Web3Utils.fromWei(multisendGasEthValue.toString())).toFixed(5)
        console.error('please fund you account in ')
        swal({
          title: "Insufficient ETH balance",
          text: `You don't have enough ETH to send to all addresses. Amount needed: ${displayMultisendGasEthValue} ETH`,
          icon: "error",
        })
        return
      }
      if ("0x000000000000000000000000000000000000bEEF" === this.tokenStore.tokenAddress) {
        // Ether
        wizard.push("multisend")
      } else {
        if (new BN(this.tokenStore.allowance).gte(new BN(this.tokenStore.totalBalance))) {
          wizard.push("multisend")
        } else {
          wizard.push("approve")
        }
      }
    } catch (e) {
      console.error(e)
      swal({
        title: "Parsing Error",
        text: e.message,
        icon: "error",
      })
    }
  }

  onGasPriceChange = (selected) => {
    if (selected) {
      this.gasPriceStore.setSelectedGasPrice(selected.value)
      this.updateCurrentFee()
    }
  }

  onGasShareChange = (selected) => {
    if (selected) {
      this.gasPriceStore.setSelectedGasShare(selected.value)
      this.updateCurrentFee()
    }
  }

  renderTokenBalance() {
    if ("0x000000000000000000000000000000000000bEEF" === this.tokenStore.tokenAddress) {
      return null
    }
    const value = parseFloat(this.tokenStore.defAccTokenBalance)
    let displayValue = value.toFixed(5)
    if ("0.00000" === displayValue) {
      displayValue = value
    }
    return (
      <div className="send-info-i">
        <p>Balance, {this.tokenStore.tokenSymbol}</p>
        <p className="send-info-amount">{displayValue}</p>
      </div>
    )
  }

  renderTokenAllowance() {
    if ("0x000000000000000000000000000000000000bEEF" === this.tokenStore.tokenAddress) {
      return null
    }
    return (
      <div className="send-info-i">
        <p>Allowance, {this.tokenStore.tokenSymbol}</p>
        <p className="send-info-amount">{this.tokenStore.allowance}</p>
      </div>
    )
  }

  renderTransferGasInfo() {
    const gasPrice = this.gasPriceStore.standardInHex
    const transferEthValue = new BN(gasPrice).times(new BN(this.state.transferGas))
    const displayTransferEthValue = parseFloat(Web3Utils.fromWei(transferEthValue.toString())).toFixed(5)
    if ("0x000000000000000000000000000000000000bEEF" === this.tokenStore.tokenAddress) {
      // Ether
      return (
        <div className="send-info-i">
          <p>Gas spent without Multisend, ETH</p>
          <p className="send-info-amount">{displayTransferEthValue}</p>
        </div>
      )
    } else {
      if (new BN(this.tokenStore.allowance).gte(new BN(this.tokenStore.totalBalance))) {
        return (
          <div className="send-info-i">
            <p>Gas spent without Multisend, ETH</p>
            <p className="send-info-amount">{displayTransferEthValue}</p>
          </div>
        )
      } else {
        return (
          <div className="send-info-i">
            <p>Gas spent without Multisend, ETH</p>
            <p className="send-info-amount">{displayTransferEthValue}</p>
          </div>
        )
      }
    }
  }

  getMultisendPlusApproveGasEthValue() {
    const gasPrice = this.gasPriceStore.standardInHex
    const approvePlusMultisendGas = (new BN(this.state.multisendGas)).plus(new BN(this.state.approveGas))
    const multisendGasEthValue = new BN(gasPrice).times(approvePlusMultisendGas)
    return multisendGasEthValue
  }

  renderMultisendGasInfo() {
    const gasPrice = this.gasPriceStore.standardInHex
    const approvePlusMultisendGas = (new BN(this.state.multisendGas)).plus(new BN(this.state.approveGas))
    const multisendGasEthValue = new BN(gasPrice).times(approvePlusMultisendGas)
    const displayMultisendGasEthValue = parseFloat(Web3Utils.fromWei(multisendGasEthValue.toString())).toFixed(5)
    if ("0x000000000000000000000000000000000000bEEF" === this.tokenStore.tokenAddress) {
      // Ether
      return (
        <div className="send-info-i">
          <p>Gas spent with Multisend, ETH</p>
          <p className="send-info-amount">{displayMultisendGasEthValue}</p>
        </div>
      )
    } else {
      if (new BN(this.tokenStore.allowance).gte(new BN(this.tokenStore.totalBalance))) {
        return (
          <div className="send-info-i">
            <p>Gas spent with Multisend, ETH</p>
            <p className="send-info-amount">{displayMultisendGasEthValue}</p>
          </div>
        )
      } else {
        return (
          <div className="send-info-i">
            <p>Gas spent with Multisend, ETH</p>
            <p className="send-info-amount">N/A</p>
          </div>
        )
      }
    }
  }

  renderSavingsGasInfo() {
    const { multisendGas, approveGas, transferGas } = this.state
    const gasPrice = this.gasPriceStore.standardInHex
    const transferEthValue = new BN(gasPrice).times(new BN(this.state.transferGas))
    const displayTransferEthValue = Web3Utils.fromWei(transferEthValue.toString())
    // const approveGasEthValue = new BN(gasPrice).times(new BN(this.state.approveGas))
    // const displayApproveGasEthValue = Web3Utils.fromWei(approveGasEthValue.toString())
    const approvePlusMultisendGas = (new BN(multisendGas)).plus(new BN(approveGas))
    const multisendGasEthValue = new BN(gasPrice).times(approvePlusMultisendGas)
    const displayMultisendGasEthValue = Web3Utils.fromWei(multisendGasEthValue.toString())
    const savedGas = (new BN(transferGas)).minus(approvePlusMultisendGas)
    const savedGasEthValue = new BN(gasPrice).times(savedGas)
    const displaySavedGasEthValue = parseFloat(Web3Utils.fromWei(savedGasEthValue.toString())).toFixed(5)
    let sign = ""
    // if (approvePlusMultisendGas.gt(new BN(transferGas))) {
    //   sign = "-"
    // }
    if ("0x000000000000000000000000000000000000bEEF" === this.tokenStore.tokenAddress) {
      // Ether
      return (
        <div className="send-info-i">
          <p>Your gas savings, ETH</p>
          <p className="send-info-amount">{sign}{displaySavedGasEthValue}</p>
        </div>
      )
    } else {
      if (new BN(this.tokenStore.allowance).gte(new BN(this.tokenStore.totalBalance))) {
        return (
          <div className="send-info-i">
            <p>Your gas savings, ETH</p>
            <p className="send-info-amount">{sign}{displaySavedGasEthValue}</p>
          </div>
        )
      } else {
        return (
          <div className="send-info-i">
            <p>Your gas savings, ETH</p>
            <p className="send-info-amount">N/A</p>
          </div>
        )
      }
    }
  }

  render() {
    return (
      <div>
        <div>
          <div className="description">
            <ol>
              <li>Choose <strong>Gas Sharing</strong></li>
              <li>Verify addresses and values</li>
              <li>Press the <strong>Next</strong> button</li>
            </ol>
            <p>
              <strong>Gas Sharing</strong> is a portion of gas saved by this service that you are OK to tip
            </p>
          </div>
          <Form className="form">
            <div className="form-inline" style={{ display: "none" }}>
              <div className="form-inline-i form-inline-i_gas-price">
                <label htmlFor="gas-price" className="multisend-label">Network Speed (Gas Price)</label>
                <Select.Creatable
                  isLoading={this.gasPriceStore.loading}
                  name="gas-price"
                  id="gas-price"
                  value={this.gasPriceStore.selectedGasPrice}
                  onChange={this.onGasPriceChange}
                  loadingPlaceholder="Fetching gas Price data ..."
                  placeholder="Please select desired network speed"
                  options={this.gasPriceStore.gasPricesArray.slice()}
                />
              </div>
            </div>

            <div className="form-inline">
              <div className="form-inline-i form-inline-i_gas-sharing">
                <label htmlFor="gas-sharing" className="multisend-label">Saved Gas Sharing</label>
                <Select.Creatable
                  isLoading={false}
                  name="gas-sharing"
                  id="gas-sharing"
                  value={this.gasPriceStore.selectedGasShare}
                  onChange={this.onGasShareChange}
                  loadingPlaceholder=""
                  placeholder="Please select desired gas sharing"
                  options={this.gasSharesArray.slice()}
                />
              </div>
            </div>
          </Form>
          <div className="send-info" style={{ padding: "15px 0px" }}>
            <div className="send-info-side">
              <div className="send-info-i">
                <p>Total to be Sent, {this.tokenStore.tokenSymbol}</p>
                <p className="send-info-amount">{this.tokenStore.totalBalance}</p>
              </div>
              {
                this.renderTokenBalance()
              }
              {this.renderTransferGasInfo()}
              <div className="send-info-i">
                <p>Total Number of tx Needed</p>
                <p className="send-info-amount">{this.tokenStore.totalNumberTx}</p>
              </div>
            </div>
            <div className="send-info-side">
              {
                this.renderTokenAllowance()
              }
              <div className="send-info-i">
                <p>Balance, ETH</p>
                <p className="send-info-amount">{this.tokenStore.ethBalance}</p>
              </div>
              {this.renderMultisendGasInfo()}
              {this.renderSavingsGasInfo()}
            </div>
          </div>
          <RecipientsDataTable data={this.tokenStore.addressesData} tokenSymbol={this.tokenStore.tokenSymbol} />
        </div>
      </div>
    );
  }
}
