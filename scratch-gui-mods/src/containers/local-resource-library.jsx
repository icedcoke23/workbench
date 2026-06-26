import bindAll from 'lodash.bindall';
import PropTypes from 'prop-types';
import React from 'react';
import {connect} from 'react-redux';
import VM from 'scratch-vm';

import {costumeUpload, soundUpload} from '../lib/file-uploader.js';
import LocalResourceLibrary from '../components/local-resource-library/local-resource-library.jsx';
import {
    getScratchBridge,
    base64ToUint8,
    mimeFromPath,
    isAudioResource
} from '../lib/electron-bridge';

/**
 * 魔改：本地资源库容器
 *
 * 通过 scratchBridge 与主进程交互：
 *   - mount 时 requestResources() 并订阅 onResources
 *   - 点击资源 → readResource(filePath) 拿 base64 → 转 Uint8Array → 走 costumeUpload / soundUpload 加入 VM
 */
class LocalResourceLibraryContainer extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, [
            'handleRefresh',
            'handleImport'
        ]);
        this.state = {
            loading: false,
            resources: []
        };
        this._unsubscribe = null;
    }
    componentDidMount () {
        const bridge = getScratchBridge();
        if (!bridge) return;
        this._unsubscribe = bridge.onResources(list => {
            this.setState({loading: false, resources: list || []});
        });
        this.setState({loading: true});
        bridge.requestResources();
    }
    componentWillUnmount () {
        if (this._unsubscribe) {
            this._unsubscribe();
            this._unsubscribe = null;
        }
    }
    handleRefresh () {
        const bridge = getScratchBridge();
        if (!bridge) return;
        this.setState({loading: true});
        bridge.requestResources();
    }
    async handleImport (resource) {
        const bridge = getScratchBridge();
        if (!bridge || !this.props.vm) return;
        const vm = this.props.vm;
        const storage = vm.runtime.storage;
        const targetId = vm.editingTarget && vm.editingTarget.id;
        if (!storage || !targetId) return;
        try {
            const res = await bridge.readResource(resource.filePath);
            if (!res || !res.ok || !res.data) {
                // eslint-disable-next-line no-console
                console.error('[workbench] readResource failed', res && res.error);
                return;
            }
            const buffer = base64ToUint8(res.data).buffer;
            const fileType = mimeFromPath(resource.filePath);
            const fileName = (resource.name || 'asset').replace(/\.[^.]+$/, '');
            if (isAudioResource(resource.filePath)) {
                soundUpload(buffer, fileType, storage, vmSounds => {
                    vmSounds.forEach((sound, i) => {
                        sound.name = `${fileName}${i ? i + 1 : ''}`;
                        vm.addSound(sound);
                    });
                });
            } else {
                costumeUpload(buffer, fileType, storage, vmCostumes => {
                    vmCostumes.forEach((costume, i) => {
                        costume.name = `${fileName}${i ? i + 1 : ''}`;
                        vm.addCostume(costume.md5, costume, targetId);
                    });
                });
            }
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error('[workbench] import resource failed', e);
        }
    }
    render () {
        return (
            <LocalResourceLibrary
                loading={this.state.loading}
                resources={this.state.resources}
                onRefresh={this.handleRefresh}
                onImport={this.handleImport}
            />
        );
    }
}

LocalResourceLibraryContainer.propTypes = {
    vm: PropTypes.instanceOf(VM)
};

const mapStateToProps = state => ({
    vm: state.scratchGui.vm
});

export default connect(mapStateToProps)(LocalResourceLibraryContainer);
