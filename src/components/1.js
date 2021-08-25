import React from 'react';
import Web3Utils from 'web3-utils';
import Form from 'react-validation/build/form';
import Textarea from 'react-validation/build/textarea';
import Button from 'react-validation/build/button';
import { form, control, button } from 'react-validation';
import { inject, observer } from "mobx-react";
import swal from 'sweetalert';
import generateElement from '../generateElement'
import Example from './example.json'
// import { PulseLoader} from 'react-spinners';
import { RadioGroup, Radio } from 'react-radio-group';
import csvtojson from 'csvtojson'
import Select from 'react-select'
import '../assets/stylesheets/react-select.min.css';


const ownInput = ({ error, isChanged, isUsed, ...props }) => (
  <div>
    {isChanged && isUsed && error}
    <input {...props} />
  </div>
);
const Input = control(ownInput);

const required = (value) => {
  if (!value.toString().trim().length) {
    return <span className="error">required</span>;
  }
};

const isAddress = (value) => {
  if (!Web3Utils.isAddress(value)) {
    return <span className="error">Token address is invalid</span>;
  }
};
// const InvalidJSON = <div>Your JSON is invalid, please visit <a href="https://jsonlint.com/" target="_blank">Online Json Validator</a></div>

// const isJson = (value) => {
//   try {
//     JSON.parse(value)
//   } catch(e) {
//     return InvalidJSON
//   }
// };

@inject("UiStore")
@observer
export class FirstStep extends React.Component {
  constructor(props) {
    super(props);
    this.tokenStore = props.UiStore.tokenStore;
    this.txStore = props.UiStore.txStore;
    this.web3Store = props.UiStore.web3Store;
    this.web3Store.setStartedUrl('#/');
    this.onTokenAddress = this.onTokenAddress.bind(this);
    this.onDecimalsChange = this.onDecimalsChange.bind(this);
    // this.onJsonChange = this.onJsonChange.bind(this);
    this.state = {
      format: 'csv',
      placeholder: `
0xCBA5018De6b2b6F89d84A1F5A68953f07554765e,12
0xa6Bf70bd230867c870eF13631D7EFf1AE8Ab85c9,1123.45645
0x00b5F428905DEA1a67940093fFeaCeee58cA91Ae,1.049
0x00fC79F38bAf0dE21E1fee5AC4648Bc885c1d774,14546
`,
      tokenAddress: { label: '', value: null },
      csv: ""
    }
    // this.onSelectFormat = this.onSelectFormat.bind(this)
    this.onParse = this.onParse.bind(this)
    this.parseCompleted = false;
    // this.list = [];

    this.props.addNextHandler(this.onNext)
  }

  componentDidMount() {
    // this.tokenStore.reset()
    // this.txStore.reset()

    if ('' !== this.tokenStore.tokenAddress) {
      const tokenInfoArray = this.web3Store.userTokens.filter(t => {
        return t.value === this.tokenStore.tokenAddress
      })
      if (tokenInfoArray.length > 0) {
        const tokenInfo = tokenInfoArray[0]
        this.setState({ tokenAddress: { ...tokenInfo } })
      }
    }

    if (this.tokenStore.jsonAddresses.length > 0) {
      const csv = this.tokenStore.jsonAddresses.reduce((csv, v) => {
        const addresses = Object.keys(v)
        const val = addresses[0] + "," + v[addresses[0]]
        return csv + val + "\n"
      }, "")
      this.setState({ csv: csv })
    }
  }
  async onTokenAddress(e) {
    if (!e) {
      this.setState({ tokenAddress: { label: '', value: '' } })
      return
    }
    const address = e.value;
    if (Web3Utils.isAddress(address)) {
      await this.tokenStore.setTokenAddress(address);
      this.setState({ tokenAddress: { label: e.label, value: e.value } })
    }
  }
  //   onSelectFormat(newFormat){
  //     this.parseCompleted = false;
  //     if(newFormat === 'csv'){
  //       this.setState({format: newFormat, placeholder: `
  // 0xCBA5018De6b2b6F89d84A1F5A68953f07554765e,12
  // 0xa6Bf70bd230867c870eF13631D7EFf1AE8Ab85c9,1123.45645
  // 0x00b5F428905DEA1a67940093fFeaCeee58cA91Ae,1.049
  // 0x00fC79F38bAf0dE21E1fee5AC4648Bc885c1d774,14546
  //   `})
  //     swal("Information", `Please provide CSV file in comma separated address,balance format one line per address.
  //     \nExample:\n
  // 0xCBA5018De6b2b6F89d84A1F5A68953f07554765e,12
  // 0xa6Bf70bd230867c870eF13631D7EFf1AE8Ab85c9,113.45
  // 0x00b5F428905DEA1a67940093fFeaCeee58cA91Ae,1.049
  // 0x00fC79F38bAf0dE21E1fee5AC4648Bc885c1d774,14546
  //     `, 'info')
  //     } else {
  //       this.setState({format: newFormat, placeholder: JSON.stringify(Example)})
  //       swal({
  //         content: generateElement(`<div style="color:black;">
  //         Please provide JSON-array file in the following format.
  //         \nExample:\n
  //         <div style="font-size: 12px;color:purple;">
  //         [<br/>
  //           {"0xCBA5018De6b2b6F89d84A1F5A68953f07554765e":"12"},
  //           {"0xa6Bf70bd230867c870eF13631D7EFf1AE8Ab85c9":"1123.45645"},
  //           {"0x00b5F428905DEA1a67940093fFeaCeee58cA91Ae":"1.049"},
  //           {"0x00fC79F38bAf0dE21E1fee5AC4648Bc885c1d774":"14546"}
  //           <br/>]
  //         </div>
  //         </div>
  //         `),
  //         icon: 'info'
  //       })
  //
  //     }
  //   }
  onDecimalsChange(e) {
    this.tokenStore.setDecimals(e.target.value)
  }

  // onJsonChange(value) {
  //   try {
  //     let addresses = JSON.parse(value);
  //     this.tokenStore.setJsonAddresses(addresses)
  //     this.parseCompleted = true;
  //   } catch(e) {
  //     const error = e.message.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
  //     console.error(error)
  //     swal({
  //       content: generateElement(`${error} Please visit <a target="_blank" href="https://jsonlint.com">JsonLint.com</a>`),
  //       icon: "error",
  //     })
  //   }
  // }

  async onCsvChange(value) {
    return new Promise((res, rej) => {
      let addresses = [];
      csvtojson({ noheader: true })
        .fromString(value)
        .on('csv', (csv) => {
          let el = {};
          if (csv.length === 2) {
            Object.defineProperty(el, csv[0], {
              value: csv[1],
              writable: true,
              configurable: true,
              enumerable: true,
            });
            addresses.push(el)
          }
        })
        .on('end', () => {
          try {
            console.log('csv is done')
            this.parseCompleted = true;
            this.tokenStore.setJsonAddresses(addresses)
            res(addresses);
          } catch (e) {
            console.error(e)
            rej(e);
            swal({
              content: "Your CSV is invalid",
              icon: "error",
            })
          }
        })
    })
  }

  onParse(e) {
    // this.list = e.target.value;
    this.setState({ csv: e.target.value })
    // if(this.state.format === 'json') {
    //   this.onJsonChange(e.target.value)
    // }
    if (this.state.format === 'csv') {
      this.onCsvChange(e.target.value)
    }
    return
  }

  onNext = async (wizard) => {
    // console.log(wizard.step)
    if ("home" !== wizard.step.id) {
      return
    }

    try {
      if (!this.parseCompleted) {
        await this.onCsvChange(this.state.csv)
      }
      await this.tokenStore.parseAddresses()
      console.log('length of addresses', this.tokenStore.jsonAddresses.length)
      if (this.tokenStore.jsonAddresses.length === 0) {
        swal({
          title: "The address list is empty.",
          text: "Please make sure you set correct CSV or JSON format in input selector",
          icon: "error",
        })
        return
      }
      if (this.tokenStore.invalid_addresses.length > 0) {
        swal({
          title: "There are invalid eth addresses. If you click Next, it will remove them from the list.",
          text: JSON.stringify(this.tokenStore.invalid_addresses.slice(), null, '\n'),
          icon: "error",
        })
        return
      }
      wizard.push("inspect")
    } catch (e) {
      console.error(e)
      swal({
        title: "Parsing Error",
        text: e.message,
        icon: "error",
      })
    }
  }

  render() {
    if (this.tokenStore.errors.length > 0) {
      swal("Error!", this.tokenStore.errors.toString(), 'error')
    }
    if (this.web3Store.errors.length > 0) {
      swal("Error!", this.web3Store.errors.toString(), 'error')
    }
    return (
      <div>
        <div className="description">
          <ol>
            <li>Select Token Address</li>
            <li>Enter comma-separated list of addresses and values to send</li>
            <li>Press the <strong>Next</strong> button</li>
          </ol>
        </div>
        <Form className="form">
          <div className="form-inline">
            <div className="form-inline-i form-inline-i_token-address">
              <label htmlFor="token-address" className="multisend-label">Token Address</label>
              <Select.Creatable
                isLoading={this.web3Store.loading}
                name="token-address"
                id="token-address"
                value={this.state.tokenAddress}
                onChange={this.onTokenAddress}
                loadingPlaceholder="Loading your token addresses..."
                placeholder="Please select a token or input the address"
                options={this.web3Store.userTokens.slice()}
              />
            </div>
          </div>

          <div className="form-inline">
            <div className="form-inline-i form-inline-i_token-address-values">
              <label htmlFor="token-address-values" className="multisend-label">List of addresses and values</label>
              <Textarea
                disabled={this.web3Store.loading}
                name="token-address-values"
                id="token-address-values"
                data-gram
                validations={[required]}
                placeholder={`Example: ${this.state.placeholder}`}
                value={this.state.csv}
                onBlur={this.onParse} id="addresses-with-balances" className="multisend-textarea"></Textarea>
            </div>
          </div>
        </Form>
      </div>
    );
  }
}
