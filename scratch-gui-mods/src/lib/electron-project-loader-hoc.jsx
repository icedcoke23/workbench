import PropTypes from 'prop-types';
import React from 'react';
import {connect} from 'react-redux';
import VM from 'scratch-vm';

import {setProjectUnchanged} from '../reducers/project-changed';
import {LoadingState, onLoadedProject} from '../reducers/project-state';
import {getScratchBridge} from '../lib/electron-bridge';

/**
 * 魔改：Electron 工作台项目加载 HOC
 *
 * 监听 preload 注入的 scratchBridge.onLoadProject 事件。
 * 当主进程通过 `scratch:load-project` 推送某点子版本的 project.json 时，
 * 加载到 VM 中，并同步 redux 的 project-state，避免与默认拉取流程冲突。
 *
 * @param {React.Component} WrappedComponent 要包裹的组件
 * @returns {React.Component} 包裹后的组件
 */
const electronProjectLoaderHOC = function (WrappedComponent) {
    class ElectronProjectLoader extends React.Component {
        componentDidMount () {
            const bridge = getScratchBridge();
            if (!bridge || !this.props.vm) return;
            // 等待 VM 启动后再加载，避免与默认空项目的 start 流程打架
            this._unsubscribe = bridge.onLoadProject(projectJson => {
                if (!projectJson) return;
                this.props.vm.loadProject(projectJson)
                    .then(() => {
                        this.props.onLoadedProject(LoadingState.LOADING_VM_FILE_UPLOAD, true, true);
                        setTimeout(() => {
                            this.props.onSetProjectUnchanged();
                            if (!this.props.vm.runtime.ioDevices.clock) return;
                            // 手动触发一次绘制
                            if (this.props.vm.renderer) {
                                this.props.vm.renderer.draw();
                            }
                        });
                    })
                    .catch(e => {
                        // eslint-disable-next-line no-console
                        console.error('[workbench] loadProject from bridge failed', e);
                    });
            });
        }
        componentWillUnmount () {
            if (this._unsubscribe) {
                this._unsubscribe();
                this._unsubscribe = null;
            }
        }
        render () {
            return <WrappedComponent {...this.props} />;
        }
    }

    ElectronProjectLoader.propTypes = {
        vm: PropTypes.instanceOf(VM),
        onLoadedProject: PropTypes.func,
        onSetProjectUnchanged: PropTypes.func
    };

    const mapStateToProps = state => ({
        vm: state.scratchGui.vm
    });

    const mapDispatchToProps = dispatch => ({
        onLoadedProject: (loadingState, canSave) =>
            dispatch(onLoadedProject(loadingState, canSave)),
        onSetProjectUnchanged: () => dispatch(setProjectUnchanged())
    });

    return connect(mapStateToProps, mapDispatchToProps)(ElectronProjectLoader);
};

export default electronProjectLoaderHOC;
