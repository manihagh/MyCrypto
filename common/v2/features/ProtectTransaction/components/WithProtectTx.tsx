import React, { useCallback, useContext, useEffect, useState } from 'react';
import styled from 'styled-components';
import { Panel } from '@mycrypto/ui';

import {
  IFormikFields,
  ISignedTx,
  IStepComponentProps,
  ITxHash,
  ITxObject,
  ITxReceipt,
  ITxSigned
} from 'v2/types';
import { isWeb3Wallet, useTxMulti } from 'v2/utils';
import { BREAK_POINTS, COLORS } from 'v2/theme';
import { useScreenSize } from 'v2/vendor';
import { processFormDataToTx } from 'v2/features/SendAssets/helpers';

import { ProtectTxProtection } from './ProtectTxProtection';
import { ProtectTxSign } from './ProtectTxSign';
import { ProtectTxReport } from './ProtectTxReport';
import { ProtectTxContext } from '../ProtectTxProvider';
import ProtectTxModalBackdrop from './ProtectTxModalBackdrop';
import { ProtectTxButton } from './ProtectTxButton';
import { ProtectTxStepper } from './ProtectTxStepper';
import { PROTECTED_TX_FEE_ADDRESS } from '../../../config';
import { ProtectTxUtils } from '../utils';

const WithProtectTxWrapper = styled.div`
  display: flex;
  flex-wrap: nowrap;
`;

const WithProtectTxMain = styled.div<{ protectTxShow: boolean }>`
  position: relative;
  flex: 0 0 100%;
  width: 100%;
  max-width: 100%;

  ${({ protectTxShow }) =>
    protectTxShow &&
    `
    @media (min-width: ${BREAK_POINTS.SCREEN_SM}) {
      flex: 0 0 calc(100vw - 375px - 4.5rem);
      width: calc(100vw - 375px - 4.5rem);
      max-width: calc(100vw - 375px - 4.5rem);
    }
  `};

  @media (min-width: ${BREAK_POINTS.SCREEN_MD}) {
    flex: 0 0 calc(650px - 4.5rem);
    width: calc(650px - 4.5rem);
    max-width: calc(650px - 4.5rem);
  }
`;

const WithProtectTxSide = styled.div`
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  width: 375px;
  min-width: 375px;
  max-width: 100vw;
  margin-top: calc(-1.5rem - 44px - 15px);

  @media (min-width: ${BREAK_POINTS.SCREEN_SM}) {
    position: initial;
    width: 375px;
    margin-top: -1.5rem;
    margin-left: 2.25rem;
    border-left: 15px solid ${COLORS.BG_GRAY};
    min-height: calc(100% + 115px);
    transform: unset;

    section {
      position: relative;
      height: 100%;
      padding: 30px 15px 15px;
      box-shadow: none;
    }
  }
`;

interface Props extends IStepComponentProps {
  customDetails?: JSX.Element;
  protectTxButton?(): JSX.Element;
}

export function withProtectTx(WrappedComponent: React.ComponentType<Props>) {
  return function WithProtectTransaction({
    txConfig: txConfigMain,
    signedTx: signedTxMain,
    txReceipt: txReceiptMain,
    onComplete: onCompleteMain,
    customDetails,
    resetFlow
  }: Props) {
    const [protectTx, setProtectTx] = useState<ITxObject | null>(null);
    const { state, initWith, prepareTx, sendTx } = useTxMulti();
    const { transactions, _currentTxIdx, account, network } = state;

    const protectTxContext = useContext(ProtectTxContext);
    const getProTxValue = ProtectTxUtils.isProtectTxDefined(protectTxContext);
    if (!getProTxValue()) {
      throw new Error('withProtectTx requires to be wrapped in ProtectTxContext!');
    }

    const {
      state: { protectTxShow, protectTxEnabled, stepIndex },
      setWeb3Wallet,
      goToNextStep,
      formCallback,
      handleTransactionReport,
      showHideProtectTx
    } = protectTxContext;

    // Wait for useTxMulti to finish initWith
    useEffect(() => {
      if (account && network && protectTx) {
        prepareTx(protectTx);
        setWeb3Wallet(isWeb3Wallet(account.wallet), account.wallet);
        goToNextStep();
      }
    }, [account, network, protectTx]);

    const protectTxStepperSteps = [
      {
        component: ProtectTxProtection,
        props: {
          sendAssetsValues: (({ values }) => values)(formCallback())
        },
        actions: {
          handleProtectTxSubmit: async (payload: IFormikFields) => {
            const { account: formAccount, network: formNetwork } = payload;
            // TODO: initWith requires some object for every tx, because of R.adjust can't operate on empty array
            await initWith(() => Promise.resolve([{}]), formAccount, formNetwork);
            setProtectTx({
              ...processFormDataToTx(payload),
              to: PROTECTED_TX_FEE_ADDRESS
            });
          }
        }
      },
      {
        component: ProtectTxSign,
        props: {
          txConfig: transactions[_currentTxIdx] && transactions[_currentTxIdx].txRaw,
          account,
          network
        },
        actions: {
          handleProtectTxConfirmAndSend: async (payload: ITxHash | ITxSigned) => {
            await handleTransactionReport();
            await sendTx(payload);
            goToNextStep();
          }
        }
      },
      {
        component: ProtectTxReport
      }
    ];

    const { isMdScreen } = useScreenSize();

    const toggleProtectTxShow = useCallback(
      e => {
        e.preventDefault();

        if (showHideProtectTx) {
          showHideProtectTx(!protectTxShow);
        }
      },
      [showHideProtectTx]
    );

    return (
      <WithProtectTxWrapper>
        <WithProtectTxMain protectTxShow={protectTxShow}>
          <WrappedComponent
            txConfig={txConfigMain}
            signedTx={signedTxMain}
            txReceipt={txReceiptMain}
            onComplete={(values: IFormikFields | ITxReceipt | ISignedTx | null) => {
              onCompleteMain(values);
            }}
            customDetails={customDetails}
            resetFlow={resetFlow}
            protectTxButton={() =>
              protectTxEnabled ? (
                <ProtectTxButton reviewReport={true} onClick={toggleProtectTxShow} />
              ) : (
                <></>
              )
            }
          />
        </WithProtectTxMain>
        {protectTxShow && (
          <>
            {!isMdScreen && <ProtectTxModalBackdrop onBackdropClick={toggleProtectTxShow} />}
            <WithProtectTxSide>
              <Panel>
                <ProtectTxStepper currentStepIndex={stepIndex} steps={protectTxStepperSteps} />
              </Panel>
            </WithProtectTxSide>
          </>
        )}
      </WithProtectTxWrapper>
    );
  };
}
