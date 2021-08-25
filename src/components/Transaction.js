import React from 'react';
import { inject, observer } from "mobx-react";

@inject("UiStore")
@observer
export class Transaction extends React.Component {
  render () {
    const { tx, explorerUrl } = this.props
    const { name, hash, status } = tx;
    let classname;
    switch(status){
      case 'mined':
        classname = 'table-td_check-hash_done'
        break;
      case 'error':
        classname = 'table-td_check-hash_error'
        break;
      case 'pending':
        classname = 'table-td_check-hash_wait'
        break;
      default:
        classname = 'table-td_check-hash_wait'
    }
    // const classname = status === 'mined' ? 'table-td_check-hash_done' : 'table-td_check-hash_wait'
    return (
      <div className="table-tr">
        <div className={`table-td table-td_check-hash ${classname}`}>
          TxHash: <a target="_blank" href={`${explorerUrl}/tx/${hash}`}>{hash}</a> <br/> {name} <br/> Status: {status}
        </div>
      </div>
    )
  }
}
