import React, { Component } from 'react';
import axios from 'axios';
import Tabs from 'react-bootstrap/Tabs';
import Tab from 'react-bootstrap/Tab';
import Alert from 'react-bootstrap/Alert';
import { withRouter } from 'react-router-dom';
import { encode as btoa } from 'base-64';
import ImageCarousel from '../elements/ImageCarousel';
import CurrentImageView from '../elements/CurrentImageView';
import BaselineImageView from '../elements/BaselineImageView';
import ImageSideBySideView from '../elements/ImageSideBySideView';
import ScreenshotHistoryView from '../elements/ScreenshotHistoryView';
import 'react-multi-carousel/lib/styles.css';
import './Default.css';

class ScreenshotView extends Component {
  constructor(props) {
    super(props);
    const { buildScreenshots } = this.props;
    this.state = {
      buildScreenshots,
      currentScreenshot: null,
      currentBaseline: null,
      currentBaselineCompareJson: null,
    };
  }

  componentDidMount() {
    const { selectedScreenshotId, selectedTab } = this.props;
    this.loadScreenshot(selectedScreenshotId);
    if (selectedTab) {
      this.handleSelect(selectedTab);
    }
  }

  componentDidUpdate(prevProps, prevState) {
    const { currentBaseLineDetails, currentScreenshotDetails } = this.state;
    if (prevState.currentBaseLineDetails !== currentBaseLineDetails) {
      // if base line details have changed, load the new image
      if (currentBaseLineDetails && currentBaseLineDetails.screenshot) {
        this.getBaselineCompare(currentScreenshotDetails._id, true);
        this.getBaselineCompareJson(currentScreenshotDetails._id);
      } else {
        this.setState({ currentBaselineCompare: undefined });
      }
    }
  }

  handleSelect(value) {
    if (['image', 'history', 'baseline', 'sidebyside'].includes(value)) this.setState({ key: value });
  }

  getScreenshotDetails = (screenshotId) => axios.get(`/screenshot/${screenshotId}`)
    .then((res) => {
      this.setState({ currentScreenshotDetails: res.data });
      const { currentScreenshotDetails } = this.state;
      if (currentScreenshotDetails != null && (currentScreenshotDetails.view !== null && currentScreenshotDetails.view !== '')) {
        // if there is a view, retrieve the history
        this.getScreenshotHistoryByView(currentScreenshotDetails.view,
          currentScreenshotDetails.platformId, 10);
        if (currentScreenshotDetails.platform) {
          this.getBaseLineDetails(currentScreenshotDetails);
        }
      } else if (currentScreenshotDetails != null) {
        this.handleSelect('image');
      }
    })

  getScreenshotHistoryByView = (view, platformId, limit, offset) => axios.get('/screenshot/', {
    params: {
      view,
      platformId,
      limit,
      offset,
    },
  })
    .then((res) => {
      this.setState({ currentScreenshotHistory: res.data });
    })

  getScreenshot = (screenshotId) => axios.get(`/screenshot/${screenshotId}/image`, { responseType: 'arraybuffer' })
    .then((res) => {
      const base64 = btoa(
        new Uint8Array(res.data).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          '',
        ),
      );
      this.setState({ currentScreenshot: `data:;base64,${base64}` });
    }).catch(() => {
      // failed to retrieve baseline.
      this.setState({ currentScreenshot: 'ERROR' });
    })

  getBaselineScreenshot = (screenshotId) => axios.get(`/screenshot/${screenshotId}/image`, { responseType: 'arraybuffer' })
    .then((res) => {
      const base64 = btoa(
        new Uint8Array(res.data).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          '',
        ),
      );
      this.setState({ currentBaseline: `data:;base64,${base64}` });
    }).catch(() => {
      // failed to retrieve baseline.
      this.setState({ currentBaseline: 'ERROR' });
    })

  getBaselineCompare = (screenshotId, useCache) => axios.get(`/screenshot/${screenshotId}/baseline/compare/image/?useCache=${useCache}`, { responseType: 'arraybuffer' })
    .then((res) => {
      const base64 = btoa(
        new Uint8Array(res.data).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          '',
        ),
      );
      this.setState({ currentBaselineCompare: `data:;base64,${base64}` });
    })
    .catch(() => {
      // failed to retrieve baseline.
      this.setState({ currentBaselineCompare: 'ERROR' });
    })

  getBaselineCompareJson = (screenshotId) => axios.get(`/screenshot/${screenshotId}/baseline/compare`)
    .then((res) => {
      this.setState({ currentBaselineCompareJson: res.data });
    })
    .catch(() => {
      // failed to retrieve baseline.
      this.setState({ currentBaselineCompareJson: {} });
    })

  getBaseLineDetails = (screenshot) => {
    let baselineQuery = `/baseline/?view=${screenshot.view}&platformName=${screenshot.platform.platformName}`;
    if (screenshot.platform.deviceName) {
      baselineQuery = `${baselineQuery}&deviceName=${screenshot.platform.deviceName}`;
    } else {
      baselineQuery = `${baselineQuery}&browserName=${screenshot.platform.browserName}&screenHeight=${screenshot.height}&screenWidth=${screenshot.width}`;
    }
    axios.get(baselineQuery)
      .then((res) => {
        const baseline = res.data[0];
        // to handle better in the future
        this.setState({ currentBaseLineDetails: baseline });
        if (baseline && baseline.screenshot._id) {
          this.getBaselineScreenshot(baseline.screenshot._id);
        }
      });
  }

  updateBaseline = (screenshot) => {
    const { currentBaseLineDetails } = this.state;
    if (currentBaseLineDetails) {
      // if there is already a base line we need to update it.
      this.makeUpdateBaselineRequest(currentBaseLineDetails._id, screenshot._id);
    } else {
      // create a new baseline
      this.setBaselineForView(screenshot);
    }
  }

  setBaselineForView = (screenshot) => axios.post('/baseline/', {
    view: screenshot.view,
    screenshotId: screenshot._id,
  })
    .then((res) => {
      this.setState({ currentBaseLineDetails: res.data });
    })

  forceBaselineCompare = (screenshotId) => this.getBaselineCompare(screenshotId, false);

  makeUpdateBaselineRequest = (baselineId, screenshotId, ignoreBoxes) => {
    const updateBaselineRequest = {};
    if (screenshotId) updateBaselineRequest.screenshotId = screenshotId;
    if (ignoreBoxes) updateBaselineRequest.ignoreBoxes = ignoreBoxes;
    return axios.put(`/baseline/${baselineId}`, updateBaselineRequest)
      .then((res) => {
        this.setState({ currentBaseLineDetails: res.data });
      });
  }

  isBaseline = (screenshotId) => {
    const { currentBaseLineDetails } = this.state;
    return (currentBaseLineDetails && currentBaseLineDetails.screenshot
      && currentBaseLineDetails.screenshot._id === screenshotId);
  }

  setTab = (key) => {
    this.handleSelect(key);
  }

  loadScreenshot = (screenshotId) => {
    const { currentScreenshotDetails } = this.state;
    if (currentScreenshotDetails === undefined || currentScreenshotDetails._id !== screenshotId) {
      this.setState({
        currentScreenshot: undefined,
        currentBaseline: undefined,
        currentScreenshotHistory: undefined,
        currentBaselineCompare: undefined,
      });
      this.getScreenshotDetails(screenshotId);
      this.getScreenshot(screenshotId);
    }
  }

  render() {
    const {
      buildScreenshots,
      currentScreenshotDetails,
      currentScreenshotHistory,
      currentScreenshot,
      key,
      currentBaseLineDetails,
      currentBaseline,
      currentBaselineCompare,
      currentBaselineCompareJson,
    } = this.state;
    if (!buildScreenshots || !currentScreenshotDetails) {
      return (
        <div className="alert alert-primary" role="alert">
          <span>
            <i className="fas fa-spinner fa-pulse fa-2x" />
            <span> Retrieving screenshot details.</span>
          </span>
        </div>
      );
    }
    return (
      <div>
        <ImageCarousel
          screenshots={buildScreenshots}
          selectedScreenshotDetails={currentScreenshotDetails}
          loadScreenshot={this.loadScreenshot}
        />
        {
          !currentScreenshotDetails.platform || !currentScreenshotDetails.view
            ? <Alert variant="info">To enable the &quot;History&quot; and &quot;Compare with Baseline&quot; tabs please provide a view and platform details when uploading the screenshots to angles.</Alert>
            : null
        }
        <Tabs id="image-tabs" activeKey={key} defaultActiveKey="image" onSelect={(tabKey, evt) => this.setTab(tabKey, evt)}>
          <Tab eventKey="image" title="Image">
            <div className="image-page-holder">
              <CurrentImageView
                currentScreenshot={currentScreenshot}
                currentScreenshotDetails={currentScreenshotDetails}
                updateBaseline={this.updateBaseline}
                isBaseline={this.isBaseline}
              />
            </div>
          </Tab>
          <Tab eventKey="history" disabled={!currentScreenshotDetails.platform || !currentScreenshotDetails.view} title="History">
            <div className="image-page-holder">
              <ScreenshotHistoryView
                currentScreenshotHistory={currentScreenshotHistory}
                currentScreenshotDetails={currentScreenshotDetails}
                currentBaseLineDetails={currentBaseLineDetails}
                isBaseline={this.isBaseline}
              />
            </div>
          </Tab>
          <Tab eventKey="baseline" title="Overlay with Baseline" disabled={!currentScreenshotDetails.platform || !currentScreenshotDetails.view}>
            <div className="image-page-holder">
              <BaselineImageView
                currentBaseLineDetails={currentBaseLineDetails}
                currentScreenshotDetails={currentScreenshotDetails}
                currentBaselineCompare={currentBaselineCompare}
                currentBaselineCompareJson={currentBaselineCompareJson}
                currentScreenshot={currentScreenshot}
                isBaseline={this.isBaseline}
                makeUpdateBaselineRequest={this.makeUpdateBaselineRequest}
                getBaselineCompare={this.getBaselineCompare}
              />
            </div>
          </Tab>
          <Tab eventKey="sidebyside" title="Side by Side with Baseline" disabled={!currentScreenshotDetails.platform || !currentScreenshotDetails.view}>
            <div className="image-page-holder">
              <ImageSideBySideView
                currentBaseLineDetails={currentBaseLineDetails}
                currentScreenshotDetails={currentScreenshotDetails}
                currentBaseline={currentBaseline}
                currentScreenshot={currentScreenshot}
                isBaseline={this.isBaseline}
              />
            </div>
          </Tab>
        </Tabs>
      </div>
    );
  }
}

export default withRouter(ScreenshotView);
