import { Field } from 'formik';
import React, { useState } from 'react';
import { Col, Row } from 'react-bootstrap';
import {
  YBFormInput,
  YBFormSelect,
  YBInputField
} from '../common/forms/fields';

import './ConfigureReplicationModal.scss';
import { YBModalForm } from '../common/forms';
import { BootstrapTable, TableHeaderColumn } from 'react-bootstrap-table';
import { IReplicationTable } from './IClusterReplication';
import { YBLoading } from '../common/indicators';
import {
  createXClusterReplication,
  fetchTablesInUniverse,
  fetchUniversesList,
} from '../../actions/xClusterReplication';

import { useMutation, useQuery, useQueryClient } from 'react-query';
import * as Yup from 'yup';
import { toast } from 'react-toastify';

const validationSchema = Yup.object().shape({
  name: Yup.string().required('Replication name is required'),
  targetUniverseUUID: Yup.string().required('Target universe UUID is required')
});

const STEPS = [
  {
    title: 'Configure Replication',
    submitLabel: 'Next: Select Tables',
    component: TargetUniverseForm
  },
  {
    title: 'Configure Replication',
    submitLabel: 'Create Replication',
    component: SelectTablesForm
  }
];

interface Props {
  onHide: Function;
  visible: boolean;
  currentUniverseUUID: string;
}

export function ConfigureReplicationModal({ onHide, visible, currentUniverseUUID }: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const queryClient = useQueryClient();
  const addReplication = useMutation(
    (values:any) => {
      return createXClusterReplication(values['targetUniverseUUID'].value, currentUniverseUUID, values['name'], values['tables'].map((t:IReplicationTable)=>t.tableUUID.replaceAll('-', '')));
    },
    {
      onSuccess: () => {
        onHide();
        queryClient.invalidateQueries('universe');
      },
      onError: (err:any) => {
        toast.error(err.response.data.error);
      }
    }
  );

  const { data: universeList, isLoading: isUniverseListLoading } = useQuery(['universeList'], () =>
    fetchUniversesList().then((res) => res.data)
  );

  const { data: tables, isLoading: isTablesLoading } = useQuery(
    [currentUniverseUUID, 'tables'],
    () => fetchTablesInUniverse(currentUniverseUUID).then((res) => res.data)
  );
  
  if (isUniverseListLoading || isTablesLoading) {
    return <YBLoading />;
  }
  
  const initialValues = {
    name: '',
    targetUniverseUUID: undefined,
    tables: []
  };

  return (
    <YBModalForm
      size="large"
      title={STEPS[currentStep].title}
      visible={visible}
      validationSchema={validationSchema}
      onFormSubmit={(values: any, { setSubmitting }: { setSubmitting: any }) => {
        setSubmitting(false);
        
        if (currentStep !== STEPS.length - 1) {
          setCurrentStep(currentStep + 1);
        } else {
          addReplication.mutateAsync(values).then(()=>{
            setCurrentStep(0);
          });
        }
      }}
      initialValues={initialValues}
      submitLabel={
        STEPS[currentStep].submitLabel
      }
      onHide={()=> {
        setCurrentStep(0);
        onHide();
      }}
      showCancelButton
      render={(values: any) =>
        STEPS[currentStep].component({
          ...values,
          tables,
          universeList,
          currentUniverseUUID
        })
      }
    >
    </YBModalForm>
  );
}

export function TargetUniverseForm({
  isEdit,
  universeList,
  initialValues,
  currentUniverseUUID
}: {
  isEdit: boolean;
  universeList: { name: string; universeUUID: string }[];
  initialValues: {};
  currentUniverseUUID: string;
}) {
  return (
    <>
      <Row>
        <Col lg={12}>
          <Field 
            name="name"
            placeHolder="Replication name"
            component={YBFormInput}
          />
        </Col>
      </Row>
      <Row>
        <Col lg={12}>
          <Field
            name="targetUniverseUUID"
            component={YBFormSelect}
            options={universeList
              .filter(((universe) => universe.universeUUID !== currentUniverseUUID))
              .map((universe) => {
                return {
                  label: universe.name,
                  value: universe.universeUUID
                };
              })}
            field={{
              name: 'targetUniverseUUID',
              value:initialValues['targetUniverseUUID']
            }}
            defaultValue={initialValues['targetUniverseUUID']}
            isDisabled={isEdit}
            label="Select target universe name"
          />
        </Col>
      </Row>
    </>
  );
}

function SelectTablesForm({
  values,
  setFieldValue,
  tables
}: {
  values: any;
  setFieldValue: any;
  tables: IReplicationTable[];
}) {

  const handleTableSelect = (row: IReplicationTable, isSelected: boolean) => {
    if (isSelected) {
      setFieldValue('tables', [...values['tables'], row]);
    } else {
      setFieldValue('tables', [
        ...values['tables'].filter((r: IReplicationTable) => r.tableUUID !== row.tableUUID)
      ]);
    }
  };
  const handleAllTableSelect = (isSelected: boolean, rows: IReplicationTable[]): boolean => {
    if (isSelected) {
      setFieldValue('tables', rows);
    } else {
      setFieldValue('tables', []);
    }
    return true;
  };
  

  return (
    <div className="select-tables-form">
      <Row className="info-search">
        <Col lg={8}>List of common tables across source and target universe</Col>
        <Col lg={4}>
          <YBInputField placeHolder="Search.." onValueChanged={(text:string) => setFieldValue('search', text)}/>
        </Col>
      </Row>
      <Row>
        <Col lg={12}>
          {values['tables'].length} of {tables.length} tables selected
        </Col>
      </Row>
      <Row className="tables-list">
        <Col lg={12}>
          <BootstrapTable
            data={
              tables.filter((table:IReplicationTable)=>{
                if(!values['search']){ return true;}
                return table.tableName.toLowerCase().indexOf(values['search'].toLowerCase()) !== -1;
              })
            }
            height={'300'}
            tableContainerClass="add-to-table-container"
            selectRow={{
              mode: 'checkbox',
              clickToSelect: true,
              onSelect: handleTableSelect,
              onSelectAll: handleAllTableSelect
            }}
          >
            <TableHeaderColumn dataField="tableUUID" hidden isKey={true} />
            <TableHeaderColumn dataField="tableName">Table Name</TableHeaderColumn>
            <TableHeaderColumn dataField="tableType">Type</TableHeaderColumn>
            <TableHeaderColumn dataField="keySpace">Keyspace</TableHeaderColumn>
            <TableHeaderColumn dataField="sizeBytes">Size</TableHeaderColumn>
          </BootstrapTable>
        </Col>
      </Row>
    </div>
  );
}