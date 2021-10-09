import {Meteor} from "meteor/meteor";
import {operationType, operationLogType} from "/imports/app/both/config"
import {commonConfig} from "../../app/both/config";
import {OperationLog} from "../../api/operationLog/operationLog";
import {DeviceManufacturer} from "../../api/deviceManufacturer/deviceManufacturer";
import {CollectionHelper} from "../collection/CollectionHelper";
import {DeviceType} from "../../api/deviceType/deviceType";
import {DeviceSeries} from "../../api/deviceSeries/deviceSeries";
import {DeviceModel} from "../../api/deviceModel/deviceModel";
import {LinkType} from "../../api/linkType/linkType";
import {GeneralCommand} from "../../api/generalCommand/generalCommand";
import {AnalyzeFunc} from "../../api/analyzeFunc/analyzeFunc";
import {DeviceProtocol} from "../../api/deviceProtocol/deviceProtocol";

const operationLogAsyncPromise = new Promise(function (resolve, reject) {
  resolve();
});


/**
 * 初始化全局变量
 * @param schema 对应数据库字段
 * @param optType 操作类型：insert、update、remove、other
 * @param dataType 操作数据类型，在config.operationLogType中配置
 * @param beforeDoc 操作前doc
 * @param afterDoc 操作化doc
 * 2021/7/7   By Nick
 */
export function simpleCreateOperationLog({schema, optType, dataType, beforeDoc, afterDoc}) {
  operationLogAsyncPromise.then(() => {
    try {
      const createLogUser = afterDoc.createdByName.split('-')[0];
      const {createdBy, createdByName, createdAt, lastUpdatedBy, lastUpdatedByName, lastUpdatedAt} = afterDoc;
      delete afterDoc.createdBy;
      delete afterDoc.createdByName;
      delete afterDoc.createdAt;
      delete afterDoc.lastUpdatedBy;
      delete afterDoc.lastUpdatedByName;
      delete afterDoc.lastUpdatedAt;
      dataFilter(createdBy, createdByName, createdAt, lastUpdatedBy, lastUpdatedByName,
        lastUpdatedAt, createLogUser, schema, optType, dataType, beforeDoc, afterDoc); // 进一步过滤
    } catch (e) {
      // 只记录错误日志，不抛异常
      Logger.debug('##### createOperationLog error #####', e);
    }
  })
}

function dataFilter(createdBy, createdByName, createdAt, lastUpdatedBy, lastUpdatedByName,
                    lastUpdatedAt, createLogUser, schema, optType, dataType, beforeDoc, afterDoc) {
  const selectDeviceType = CollectionHelper.getDoc(DeviceType, {_id: afterDoc.deviceType}) || '';
  const selectManufacturer = CollectionHelper.getDoc(DeviceManufacturer, {_id: afterDoc.manufacturer}) || '';
  const selectSeries = CollectionHelper.getDoc(DeviceSeries, {_id: afterDoc.series}) || '';  // 通用字段设置name提示
  switch (dataType) {
    case operationLogType.deviceType:
      break;
    case operationLogType.deviceManufacturer:
      break;
    case operationLogType.deviceSeries:
      afterDoc = Object.assign({}, afterDoc, {'manufacturerName': selectManufacturer.name});
      break;
    case operationLogType.deviceModel:
      afterDoc = Object.assign({}, afterDoc,
        {'deviceTypeName': selectDeviceType.name},
        {'manufacturerName': selectManufacturer.name},
        {'seriesName': selectSeries.name});
      break;
    case operationLogType.linkType:
      break;
    case operationLogType.protocolType:
      break;
    case operationLogType.analyzeFunc:
      break;
    case operationLogType.generalFunc:
      afterDoc = Object.assign({}, afterDoc,
        {'deviceTypeName': selectDeviceType.name},
        {'type': `${afterDoc.type}(${commonConfig.commandType[afterDoc.type - 1].label})`});
      break;
    case operationLogType.generalParam:
      afterDoc = Object.assign({}, afterDoc,
        {'deviceTypeName': selectDeviceType.name});
      break;
    case operationLogType.deviceProtocol:
      const selectLinkType = CollectionHelper.getDoc(LinkType, {_id: afterDoc.linkType});
      afterDoc = Object.assign({}, afterDoc,
        {'deviceTypeName': selectDeviceType.name},
        {'manufacturerName': selectManufacturer.name},
        {'LinkTypeName': selectLinkType.name});
      break;
    case operationLogType.generalCommand:
      afterDoc = Object.assign({}, afterDoc,
        {'deviceTypeName': selectDeviceType.name},
        {'generalCommandType': `${afterDoc.generalCommandType}(${commonConfig.commandType[afterDoc.generalCommandType - 1].label})`});
      break;
    case operationLogType.deviceCommand:
      const selectGeneralCommand = CollectionHelper.getDoc(GeneralCommand, {_id: afterDoc.generalCommand}) || '';
      const protocolInfo = CollectionHelper.getDoc(DeviceProtocol, {_id: afterDoc.protocol}) || '';
      const encodeFunc = CollectionHelper.getDoc(AnalyzeFunc, {_id: afterDoc.encodeFunc}) || '';
      const decodeFunc = CollectionHelper.getDoc(AnalyzeFunc, {_id: afterDoc.decodeFunc}) || '';
      const paramProcessFunc = CollectionHelper.getDoc(AnalyzeFunc, {_id: afterDoc.paramProcessFunc}) || '';
      afterDoc = Object.assign({}, afterDoc,
        {'generalCommandName': selectGeneralCommand.methodName},
        {'commandType': `${afterDoc.commandType}(${commonConfig.commandType[afterDoc.commandType - 1].label})`},
        {'encodeFuncName': encodeFunc.methodName || ''},
        {'decodeFuncName': decodeFunc.methodName || ''},
        {'paramProcessFuncName': paramProcessFunc.methodName || ''},
        {'protocolName': protocolInfo.protocolName || ''},
      );
      break;
    case operationLogType.device:
      const deviceModelInfo = CollectionHelper.getDoc(DeviceModel, {_id: afterDoc.model});
      afterDoc = Object.assign({}, afterDoc,
        {'deviceModelName': deviceModelInfo.name},
        {'deviceTypeName': selectDeviceType.name},
        {'manufacturerName': selectManufacturer.name},
        {'seriesName': selectSeries.name}
      );
      break;
  }
  afterDoc = mappingDataInfo(afterDoc, schema);
  beforeDoc = mappingDataInfo(beforeDoc, schema);
  const iDoc = beforeWriteOperationLog(createdBy, createdByName, createdAt, lastUpdatedBy, lastUpdatedByName,
    lastUpdatedAt, createLogUser, schema, optType, dataType, beforeDoc, afterDoc);
  OperationLog.insert({...iDoc});
}

function mappingDataInfo(mapData, schema) {   // 映射开始
  if (!mapData) return;
  Object.keys(mapData).forEach(mapKey => {
    if (schema.hasOwnProperty(mapKey)) {
      if (schema[mapKey].type === 'Array') {
        mapData[mapKey].forEach(function (item, mKey) {
          if (!mapData[schema[mapKey].label]) mapData[schema[mapKey].label] = [];
          mapData[schema[mapKey].label][mKey] = mappingDataInfo(item, schema[mapKey].profile); // 如字段为数组则继续递归
          delete mapData[schema[mapKey].field]; // 删除原有字段
        });
      } else if (schema[mapKey].type === 'Object') {
        mapData[schema[mapKey].label] = mappingDataInfo(mapData[mapKey], schema[mapKey].profile); // 如字段为对象则继续递归
        delete mapData[schema[mapKey].field];
      } else {
        mapData[schema[mapKey].label] = mapData[schema[mapKey].field];
        if (schema[mapKey].field === 'name' ||
          schema[mapKey].field === 'protocolName' ||
          schema[mapKey].field === 'methodName') {
        } else {
          delete mapData[schema[mapKey].field];
        }
      }
    }
  });
  return mapData;
}

function beforeWriteOperationLog(createdBy, createdByName, createdAt, lastUpdatedBy, lastUpdatedByName,
                                 lastUpdatedAt, createLogUser, schema, optType, dataType, beforeDoc, afterDoc) {
  let insertDoc = {};
  switch (optType) {
    case operationType.insert:
      insertDoc = {
        updateFields: `新增信息详情：${JSON.stringify(afterDoc)}`,
        operationLogType: optType,
        specificOperation: `${createLogUser}新增了${dataType}:${afterDoc.name || afterDoc.protocolName || afterDoc.methodName || ''}`,
        operationLogSchemas: dataType
      };
      break;
    case operationType.update:
      delete beforeDoc.createdBy;
      delete beforeDoc.createdByName;
      delete beforeDoc.createdAt;
      delete beforeDoc.lastUpdatedBy;
      delete beforeDoc.lastUpdatedByName;
      delete beforeDoc.lastUpdatedAt;
      const updateData = filterUpdateData(beforeDoc, afterDoc);
      insertDoc = {
        updateFields: `修改信息详情：
         修改前：${JSON.stringify(updateData.beforeData)}
         修改后：${JSON.stringify(updateData.diff)} `,
        operationLogType: optType,
        specificOperation: `${lastUpdatedByName.split('-')[0]}修改了${dataType}:${beforeDoc.name || beforeDoc.protocolName || beforeDoc.methodName || ''}`,
        operationLogSchemas: dataType
      };
      break;
    case operationType.remove:
      delete afterDoc.isDeleted;
      insertDoc = {
        updateFields: `删除信息详情：${JSON.stringify(afterDoc)}`,
        operationLogType: optType,
        specificOperation: `${lastUpdatedByName.split('-')[0]}删除了${dataType}:${afterDoc.name || afterDoc.protocolName || afterDoc.methodName || ''}`,
        operationLogSchemas: dataType
      };
      break;
  }
  const finalData = {  // 整理数据
    ...insertDoc,
    createdBy,
    createdByName,
    createdAt,
    lastUpdatedBy,
    lastUpdatedByName,
    lastUpdatedAt
  };
  return finalData;
}

function filterUpdateData(beforeDoc, afterDoc) { // 修改分支数据前后比较
  let diff = {};        // 差异数据
  let beforeData = {};  // 修改前差异数据
  let supportInfo = {}; // 部分提示数据
  let vChildren;
  Object.keys(afterDoc).forEach(fKey => {
    Logger.debug('fKey', fKey);
    if (afterDoc.hasOwnProperty(fKey)) {
      if (!beforeDoc[fKey]) {
        supportInfo[fKey] = afterDoc[fKey];   // 加入afterDoc中附加信息
      } else if (typeof beforeDoc[fKey] === "object" && typeof afterDoc[fKey] === "object" && beforeDoc[fKey] && afterDoc[fKey]) {
        vChildren = filterUpdateData(beforeDoc[fKey], afterDoc[fKey]);  // 数据中含有对象则继续递归
        if (Object.keys(vChildren).length > 0) {
          beforeData[fKey] = vChildren.beforeData;
          diff[fKey] = vChildren.diff;
        }
      } else if (beforeDoc[fKey] !== afterDoc[fKey]) {
        beforeData[fKey] = beforeDoc[fKey];
        diff[fKey] = afterDoc[fKey];
      }
    }
  });
  diff = {...diff, ...supportInfo};
  return {diff, beforeData};
}

// 抽离collection需要进行变化判断的字段与映射关系
const deviceType = {
  name: {
    field: 'name',
    label: '设备名称',
    type: 'String',
  },
  deviceTypeNo: {
    field: 'deviceTypeNo',
    label: '设备编号',
    type: 'String',
  },
  remarks: {
    field: 'remarks',
    label: '备注',
    type: 'String',
  },
};
const deviceManufacturer = {
  name: {
    field: 'name',
    label: '厂家名称',
    type: 'String',
  },
  website: {
    field: 'website',
    label: '厂家官网',
    type: 'String',
  },
  remarks: {
    field: 'remarks',
    label: '备注',
    type: 'String',
  },
  logo: {
    field: 'logo',
    label: '厂家logo(img地址)',
    type: 'String',
  },
  manufacturerNo: {
    field: 'manufacturerNo',
    label: '厂家编号',
    type: 'String',
  }
};
const deviceSeries = {
  name: {
    field: 'name',
    label: '系列名称',
    type: 'String',
  },
  remarks: {
    field: 'remarks',
    label: '备注',
    type: 'String',
  },
  manufacturer: {
    field: 'manufacturer',
    label: '厂家id',
    type: 'String',
  },
  manufacturerName: {
    field: 'manufacturerName',
    label: '厂家名称',
    type: 'String',
  },
  manufacturer_series: {
    field: 'manufacturer_series',
    label: '厂家id_系列',
    type: 'String',
  },
  seriesNo: {
    field: 'seriesNo',
    label: '系列编号',
    type: 'String',
  }
};
const deviceModel = {
  name: {
    field: 'name',
    label: '型号名称',
    type: 'String',
  },
  remarks: {
    field: 'remarks',
    label: '备注',
    type: 'String',
  },
  manufacturer: {
    field: 'manufacturer',
    label: '厂家id',
    type: 'String',
  },
  deviceType: {
    field: 'deviceType',
    label: '类别id',
    type: 'String',
  },
  series: {
    field: 'series',
    label: '系列id',
    type: 'String',
  },
  manufacturerName: {
    field: 'manufacturerName',
    label: '厂家名称',
    type: 'String',
  },
  deviceTypeName: {
    field: 'deviceTypeName',
    label: '类别名称',
    type: 'String',
  },
  seriesName: {
    field: 'seriesName',
    label: '系列名称',
    type: 'String',
  },
  deviceType_manufacturer_series_model: {
    field: 'deviceType_manufacturer_series_model',
    label: '类别_厂家_系列_型号id',
    type: 'String',
  },
  modelNo: {
    field: 'modelNo',
    label: '系列编号',
    type: 'String',
  }
};
const linkType = {
  name: {
    field: 'name',
    label: '链路名称',
    type: 'String',
  },
  remarks: {
    field: 'remarks',
    label: '备注',
    type: 'String',
  },
  linkTypeNo: {
    field: 'linkTypeNo',
    label: '链路序号',
    type: 'String',
  },
};
const protocolType = {
  name: {
    field: 'name',
    label: '协议类别名',
    type: 'String',
  },
  remarks: {
    field: 'remarks',
    label: '备注',
    type: 'String',
  },

};
const analyzeFunc = {

  name: {
    field: 'name',
    label: '方法标题',
    type: 'String',
  },
  type: {
    field: 'type',
    label: '方法类型',
    type: 'String',
  },
  function: {
    field: 'function',
    label: '解析详情',
    type: 'String',
  },
  remarks: {
    field: 'remarks',
    label: '备注',
    type: 'String',
  },
  analyzeFuncNo: {
    field: 'analyzeFuncNo',
    label: '自定义函数编号',
    type: 'String',
  },
};
const generalFunc = {
  name: {
    field: 'name',
    label: '通用方法名',
    type: 'String',
  },
  deviceType: {
    field: 'deviceType',
    label: '设备类型id',
    type: 'String',
  },
  deviceTypeName: {
    field: 'deviceTypeName',
    label: '设备类型名称',
    type: 'String',
  },
  alias: {
    field: 'alias',
    label: '方法别名',
    type: 'String',
  },
  type: {
    field: 'type',
    label: '方法类型',
    type: 'String',
  },
  remarks: {
    field: 'remarks',
    label: '备注',
    type: 'String',
  }
};
const deviceCommand = {
  generalCommand: {
    field: 'generalCommand',
    label: '通用命令id',
    type: 'String',
  },
  commandName: {
    field: 'commandName',
    label: '命令名称',
    type: 'String',
  },
  commandType: {
    field: 'commandType',
    label: '命令类型',
    type: 'String',
  },
  commandOrientation: {
    field: 'commandOrientation',
    label: '命令方向',
    type: 'String',
  },
  remarks: {
    field: 'remarks',
    label: '备注',
    type: 'String',
  },
  noResponse: {
    field: 'noResponse',
    label: '是否无返回',
    type: 'String',
  },
  analyzeWay: {
    field: 'analyzeWay',
    label: '解析方式',
    type: 'String',
  },
  encodeFunc: {
    field: 'encodeFunc',
    label: '编码函数id',
    type: 'String',
  },
  decodeFunc: {
    field: 'decodeFunc',
    label: ' 解码函数id',
    type: 'String',
  },
  paramProcessFunc: {
    field: 'paramProcessFunc',
    label: '参数处理函数id',
    type: 'String',
  },
  protocol: {
    field: 'protocol',
    label: '协议id',
    type: 'String',
  },
  minCtrInterval: {
    field: 'minCtrInterval',
    label: '最小控制间隔',
    type: 'String',
  },
  waitingTime: {
    field: 'waitingTime',
    label: '等待时长',
    type: 'String',
  },
  reqStreamStr: {
    field: 'reqStreamStr',
    label: '控制码流模版',
    type: 'String',
  },
  reqExample: {
  	field: 'reqExample',
  	label: '控制码流模版示例',
  	type: 'String',  
  },
  rspStreamStr: {
    field: 'rspStreamStr',
    label: '响应码流模版',
    type: 'String',
  },
  rspExample: {
  	field: 'rspExample',
  	label: '响应码流模版示例',
  	type: 'String',  
  },
  reqStream: {
    field: 'reqStream',
    label: '控制码流模版校验',
    type: 'Array',
    profile: {}
  },
  rspStream: {
    field: 'rspStream',
    label: '响应码流模版校验',
    type: 'Array',
    profile: {}
  },
  relatedCommands: {
    field: 'relatedCommands',
    label: '关联控制',
    type: 'Array',
    profile: {}
  },
  combinedStoreKeys: {
    field: 'combinedStoreKeys',
    label: '联合storeKey',
    type: 'Array',
    profile: {}
  },
  commandSpecial: {
    field: 'commandSpecial',
    label: '特殊命令',
    type: 'Object',
    profile: {
      funcCode: {
        type: 'String',
        label: '方法编码',
        field: 'funcCode',
      },
      startingAddress: {
        type: 'String',
        label: '开始位',
        field: 'startingAddress',
      },
      nOfRegisters: {
        type: 'String',
        label: '寄存器读取数量',
        field: 'nOfRegisters',
      },
      isStartFunc: {
        type: 'String',
        label: '开始位是否固定',
        field: 'isStartFunc',
      },
      startFunc: {
        type: 'String',
        label: '开始位方法',
        field: 'startFunc',
      },
      httpMethod: {
        type: 'String',
        label: 'http method',
        field: 'httpMethod',
      },
      httpUrl: {
        type: 'String',
        label: 'http url',
        field: 'httpUrl',
      },
      httpUrlParams: {
        type: 'Array',
        label: 'http url 参数',
        field: 'httpUrlParams',
      },
      httpContentType: {
        type: 'String',
        label: 'http content type',
        field: 'httpContentType',
      },
      httpHeaders: {
        type: 'Array',
        label: 'http headers',
        field: 'httpHeaders',
      },
      httpContent: {
        type: 'Array',
        label: 'http content',
        field: 'httpContent',
      },
      httpResponse: {
        type: 'Array',
        label: 'http response',
        field: 'httpResponse',
      },
      // http text/html 相关
      httpContentStr: {
        type: 'String',
        label: 'http content str',
        field: 'httpContentStr',
      },
      httpContentParams: {
        type: 'Array',
        label: 'http content params',
        field: 'httpContentParams',
      },
      httpResponseStr: {
        type: 'String',
        label: 'http response str',
        field: 'httpResponseStr',
      },
      httpResponseParams: {
        type: 'Array',
        label: 'http response params',
        field: 'httpResponseParams',
      },
    }
  },
  commandNo: {
    field: 'commandNo',
    label: '设备命令编号',
    type: 'String',
  },
  generalCommandName: {
    field: 'generalCommandName',
    label: '通用命令名称',
    type: 'String',
  },
  encodeFuncName: {
    field: 'encodeFuncName',
    label: '编码函数名称',
    type: 'String',
  },
  decodeFuncName: {
    field: 'decodeFuncName',
    label: '解码函数名称',
    type: 'String',
  },
  paramProcessFuncName: {
    field: 'paramProcessFuncName',
    label: '参数处理函数名称',
    type: 'String',
  },
  protocolName: {
    field: 'protocolName',
    label: '协议名称',
    type: 'String',
  },
};
const deviceProtocol = {
  linkType: {
    field: 'linkType',
    label: '链路类型id',
    type: 'String',
  },
  deviceType: {
    field: 'deviceType',
    label: '设备类型id',
    type: 'String',
  },
  deviceTypeName: {
    field: 'deviceTypeName',
    label: '设备类型名称',
    type: 'String',
  },
  LinkTypeName: {
    field: 'LinkTypeName',
    label: '链路类型名称',
    type: 'String',
  },
  protocolName: {
    field: 'protocolName',
    label: '协议名称',
    type: 'String',
  },
  protocolType: {
    field: 'protocolType',
    label: '设备协议id',
    type: 'String',
  },
  protocolParam: {
    field: 'protocolParam',
    label: '协议参数',
    type: 'Object',
    profile: {
      port: {
        field: 'port',
        label: '端口号',
        type: 'String',
      },
      defaultReceivePort: {
        field: 'defaultReceivePort',
        label: '默认接受端口号',
        type: 'String',
      },
      defaultSendPort: {
        field: 'defaultSendPort',
        label: '默认发送端口号',
        type: 'String',
      },
      baudRate: {
        field: 'baudRate',
        label: '波特率',
        type: 'String',
      },
      dataBitLen: {
        field: 'dataBitLen',
        label: '通信位位数',
        type: 'String',
      },
      stopBitLen: {
        field: 'stopBitLen',
        label: '停止位位数',
        type: 'String',
      },
      parity: {
        field: 'parity',
        label: '奇偶校验位',
        type: 'String',
      },
    }
  },
  delimiter: {
    type: 'String',
    label: '分隔符',
    field: 'delimiter',
  },
  startChar: {
    type: 'String',
    label: '起始符',
    field: 'startChar',
  },
  lenCharStartPos: {
    type: 'String',
    label: '长度符开始位置',
    field: 'lenCharStartPos',
  },
  lenCharLength: {
    type: 'String',
    label: '长度符长度',
    field: 'lenCharLength',
  },
  addrCharStartPos: {
    type: 'String',
    label: '地址符开始位置',
    field: 'addrCharStartPos',
  },
  addrCharLength: {
    type: 'String',
    label: '地址符长度',
    field: 'addrCharLength',
  },
  computedDataStartPos: {
    type: 'String',
    label: '需要计算长度数据的开始位置',
    field: 'computedDataStartPos',
  },
  terminatorRelPos: {
    type: 'String',
    label: '终止符的相对位置',
    field: 'terminatorRelPos',
  },
  collectWay: {
    field: 'collectWay',
    label: '数据采集方式',
    type: 'String',
  },
  remarks: {
    field: 'remarks',
    label: '备注',
    type: 'String',
  },
  minCollectInterval: {
    field: 'minCollectInterval',
    label: '最小采样周期',
    type: 'String',
  },
  protocolVer: {
    field: 'protocolVer',
    label: '协议版本',
    type: 'String',
  },
  manufacturer: {
    field: 'manufacturer',
    label: '厂家id',
    type: 'String',
  },
  manufacturerName: {
    field: 'manufacturerName',
    label: '厂家名称',
    type: 'String',
  },
  protocolNo: {
    field: 'protocolNo',
    label: '设备协议编号',
    type: 'String',
  }
};
const generalCommand = {
  deviceType: {
    field: 'deviceType',
    label: '设备类型id',
    type: 'String',
  },
  deviceTypeName: {
    field: 'deviceTypeName',
    label: '设备类型名称',
    type: 'String',
  },
  methodName: {
    field: 'methodName',
    label: '命令名称',
    type: 'String',
  },
  generalCommandType: {
    field: 'generalCommandType',
    label: '通用命令类型',
    type: 'String',
  },
  methodAlias: {
    field: 'methodAlias',
    label: '命令别名',
    type: 'String',
  },
  remarks: {
    field: 'remarks',
    label: '备注',
    type: 'String',
  },
  statusParams: {
    field: 'statusParams',
    label: '响应参数',
    type: 'Array',
    profile: {
      enumList: {
        type: 'Array',
        label: '参数可选值',
        field: 'enumList',
        profile: {
          key: {
            type: 'String',
            label: '枚举key',
            field: 'key',
          },
          value: {
            type: 'String',
            label: '枚举value',
            field: 'value',
          },
          alias: {
            type: 'String',
            label: '枚举别名',
            field: 'alias',
          },
        }
      },
      paramKey: {
        type: 'String',
        label: '参数key',
        field: 'paramKey',
      },
      paramValue: {
        type: 'String',
        label: '参数默认值',
        field: 'paramValue',
      },
      paramAlias: {
        type: 'String',
        label: '参数别名',
        field: 'paramAlias',
      },
      storeKey: {
        type: 'String',
        label: '存储键',
        field: 'storeKey',
      },
      storeKeyAlias: {
        type: 'String',
        label: '存储键别名',
        field: 'storeKeyAlias',
      },
      dataType: {
        type: 'String',
        label: '数据类型',
        field: 'dataType',
      },

    }
  },
  controlParams: {
    field: 'controlParams',
    label: '上报参数',
    type: 'Array',
    profile: {
      enumList: {
        type: 'Array',
        label: '参数可选值',
        field: 'enumList',
        profile: {
          key: {
            type: 'String',
            label: '枚举key',
            field: 'key',
          },
          value: {
            type: 'String',
            label: '枚举value',
            field: 'value',
          },
          alias: {
            type: 'String',
            label: '枚举别名',
            field: 'alias',
          },
        }
      },
      paramKey: {
        type: 'String',
        label: '参数key',
        field: 'paramKey',
      },
      paramValue: {
        type: 'String',
        label: '参数默认值',
        field: 'paramValue',
      },
      paramAlias: {
        type: 'String',
        label: '参数别名',
        field: 'paramAlias',
      },
      storeKey: {
        type: 'String',
        label: '存储键',
        field: 'storeKey',
      },
      storeKeyAlias: {
        type: 'String',
        label: '存储键别名',
        field: 'storeKeyAlias',
      },
      dataType: {
        type: 'String',
        label: '数据类型',
        field: 'dataType',
      },

    }
  },
  paramKeyHash: {
    field: 'paramKeyHash',
    label: '参数哈希key',
    type: 'String',
  },
  generalCommandNo: {
    field: 'generalCommandNo',
    label: '通用命令编号',
    type: 'String',
  },
};
const device = {
  deviceCode: {
    field: 'deviceCode',
    type: 'String',
    label: '设备编码'
  },
  deviceType: {
    field: 'deviceType',
    type: 'String',
    label: '设备类别id'
  },
  manufacturer: {
    field: 'manufacturer',
    type: 'String',
    label: '设备厂家id'
  },
  series: {
    field: 'series',
    type: 'String',
    label: '设备系列id'
  },
  model: {
    field: 'model',
    type: 'String',
    label: '设备型号id'
  },
  unidirectional: {
    field: 'unidirectional',
    type: 'String',
    label: '是否是单向设备',
  },
  protocols: {
    field: 'protocols',
    type: 'Array',
    label: '设备协议',
    profile: {
      deviceChannel: {
        field: 'deviceChannel',
        type: 'String',
        label: '设备通道'
      },
      protocol: {
        field: 'protocol',
        type: 'String',
        label: '设备协议id' // 关联到 device_protocol 表
      },
    }
  },
  deviceVer: {
    field: 'deviceVer',
    type: 'String',
    label: '设备版本',
  },
  description: {
    field: 'description',
    type: 'String',
    label: '描述信息',
  },
  minCtrInterval: {
    field: 'minCtrInterval',
    type: 'String',
    label: '最小控制间隔',
  },
  remarks: {
    field: 'remarks',
    type: 'String',
    label: '备注',
  },
  manufacturerName: {
    field: 'manufacturerName',
    label: '厂家名称',
    type: 'String',
  },
  deviceTypeName: {
    field: 'deviceTypeName',
    label: '类别名称',
    type: 'String',
  },
  seriesName: {
    field: 'seriesName',
    label: '系列名称',
    type: 'String',
  },
};
const generalParam = {
  name: {
    field: 'name',
    label: '参数名',
    type: 'String',
  },
  alias: {
    field: 'alias',
    label: '参数别名',
    type: 'String',
  },
  type: {
    field: 'type',
    label: '参数类型',
    type: 'String',
  },
  deviceType: {
    field: 'deviceType',
    label: '设备类型id',
    type: 'String',
  },
  deviceTypeName: {
    field: 'deviceTypeName',
    label: '类别名称',
    type: 'String',
  },
  remarks: {
    field: 'remarks',
    label: '备注',
    type: 'String',
  },
};

// 备用后期用户表控制
// const user = {
//   title: '用户管理',
//   summaryTitle: '用户名：',
//   summaryFields: ['name'],
//   fields: [
//     {
//       field: 'name',
//       label: '用户名',
//       type: 'String',
//     },
//     {
//       field: 'profile',
//       label: '个人信息',
//       type: 'BaseInObject',
//       displayFields: ['name', 'employeeNumber', 'tel', 'email', 'dept', 'position'],
//     },
//   ]
// };

const specialOperation = {
  title: '特殊操作日志'
};

export const operationLogConfig = {
  device: device,
  generalCommand: generalCommand,
  deviceCommand: deviceCommand,
  deviceProtocol: deviceProtocol,
  deviceType: deviceType,
  deviceManufacturer: deviceManufacturer,
  deviceSeries: deviceSeries,
  deviceModel: deviceModel,
  linkType: linkType,
  protocolType: protocolType,
  analyzeFunc: analyzeFunc,
  generalFunc: generalFunc,
  generalParam: generalParam,
  specialOperation: specialOperation,
  // user: user
};


