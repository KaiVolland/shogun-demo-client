import React from 'react';

import {
  Alert,
  notification
} from 'antd';

import ConfigProvider from 'antd/lib/config-provider';
import deDE from 'antd/lib/locale/de_DE';
import enGB from 'antd/lib/locale/en_GB';

import {
  defaults as OlControlDefaults
} from 'ol/control';
import OlLayerGroup from 'ol/layer/Group';
import OlLayerTile from 'ol/layer/Tile';
import OlMap from 'ol/Map';
import {
  fromLonLat
} from 'ol/proj';
import OlSourceOsm from 'ol/source/OSM';
import OlSourceTileWMS from 'ol/source/TileWMS';
import OlView from 'ol/View';
import {
  render
} from 'react-dom';
import {
  Provider
} from 'react-redux';

import Logger from '@terrestris/base-util/dist/Logger';
import UrlUtil from '@terrestris/base-util/dist/UrlUtil/UrlUtil';

import MapContext from '@terrestris/react-geo/dist/Context/MapContext/MapContext';

import Application from '@terrestris/shogun-util/dist/model/Application';
import ShogunApplicationUtil from '@terrestris/shogun-util/dist/parser/ShogunApplicationUtil';
import SHOGunClient from '@terrestris/shogun-util/dist/service/SHOGunClient';

import App from './App';
import i18n from './i18n';
import {
  store
} from './store/store';

import {
  setTitle
} from './store/title';

import './index.less';

const client = new SHOGunClient({
  // TODO Make configurable
  url: '/'
});

const parser = new ShogunApplicationUtil({
  client
});

const getConfigLang = (lang: string) => {
  switch (lang) {
    case 'en':
      return enGB;
    case 'de':
      return deDE;
    default:
      return enGB;
  }
};

const getApplicationConfiguration = async () => {
  const applicationId = UrlUtil.getQueryParam(window.location.href, 'applicationId');

  if (!applicationId) {
    Logger.info('No application ID given, can\'t load any configuration.');
    return;
  }

  Logger.info(`Loading application with ID ${applicationId}`);

  let application;
  try {
    application = await client.application().findOne(applicationId);

    return application;
  } catch (error) {
    Logger.error(`Error while loading application with ID ${applicationId}: ${error}`);

    notification.error({
      message: i18n.t('Index.applicationLoadErrorMessage'),
      description: i18n.t('Index.applicationLoadErrorDescription', {
        applicationId: applicationId
      }),
      duration: 0
    });
  }
};

const setApplicationToStore = async (application?: Application) => {
  if (!application) {
    Logger.info('No application configuration provided, the default store will be loaded');

    return;
  }

  if (application.name) {
    store.dispatch(setTitle(application.name));
  }
};

const setupSHOGunMap = async (application: Application) => {
  const view = await parser.parseMapView(application);
  const layers = await parser.parseLayerTree(application);

  return new OlMap({
    view,
    layers,
    controls: OlControlDefaults({
      zoom: false
    })
  });
};

const setupDefaultMap = () => {
  const osmLayer = new OlLayerTile({
    source: new OlSourceOsm()
  });
  osmLayer.set('name', 'OpenStreetMap');

  const temperatureLayer = new OlLayerTile({
    opacity: 0.5,
    visible: true,
    source: new OlSourceTileWMS({
      url: 'https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi',
      projection: 'EPSG:3857',
      params: {
        LAYERS: 'MERRA2_2m_Air_Temperature_Assimilated_Monthly'
      }
    })
  });
  temperatureLayer.set('name', '2-meter Air Temperature, Assimilated (Monthly, MERRA2)');

  const eoLayerGroup = new OlLayerGroup({
    layers: [temperatureLayer]
  });
  eoLayerGroup.set('name', 'NASA Earth Observations');

  const backgroundLayerGroup = new OlLayerGroup({
    layers: [osmLayer]
  });
  backgroundLayerGroup.set('name', 'Background');

  const center = fromLonLat([0, 40], 'EPSG:3857');

  return new OlMap({
    view: new OlView({
      center: center,
      zoom: 0
    }),
    layers: [backgroundLayerGroup, eoLayerGroup],
    controls: OlControlDefaults({
      zoom: false
    })
  });
};

const renderApp = async () => {
  try {
    const appConfig = await getApplicationConfiguration();

    let map;
    if (appConfig) {
      setApplicationToStore(appConfig);
      map = await setupSHOGunMap(appConfig);
    } else {
      map = setupDefaultMap();
    }

    render(
      <React.StrictMode>
        <React.Suspense fallback={<span></span>}>
          <ConfigProvider locale={getConfigLang(i18n.language)}>
            <Provider store={store}>
              <MapContext.Provider value={map}>
                <App />
              </MapContext.Provider>
            </Provider>
          </ConfigProvider>
        </React.Suspense>
      </React.StrictMode>,
      document.getElementById('app')
    );
  } catch (error) {
    Logger.error(error);

    render(
      <React.StrictMode>
        <Alert
          className="error-boundary"
          message={i18n.t('Index.errorMessage')}
          description={i18n.t('Index.errorDescription')}
          type="error"
          showIcon
        />
      </React.StrictMode>,
      document.getElementById('app')
    );
  }
};

renderApp();