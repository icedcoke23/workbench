import PropTypes from 'prop-types';
import React from 'react';

import styles from './local-resource-library.css';
import refreshIcon from './icon--refresh.svg';
import folderIcon from './icon--folder.svg';

/**
 * 魔改：本地资源库侧边栏组件
 *
 * 从 Electron 工作台主进程拉取资源库列表（图片/音频），
 * 点击单个资源即导入到当前 VM 的编辑目标：
 *   - 图片 → 作为造型 (costume) 加入
 *   - 音频 → 作为声音 (sound) 加入
 *
 * 仅在运行于 Electron 工作台内时渲染。
 */
const LocalResourceLibrary = props => (
    <div className={styles.wrapper}>
        <div className={styles.header}>
            <div className={styles.title}>
                <img src={folderIcon} className={styles.titleIcon} />
                <span>本地资源库</span>
            </div>
            <button
                className={styles.refreshBtn}
                onClick={props.onRefresh}
                title="刷新资源列表"
            >
                <img src={refreshIcon} />
            </button>
        </div>
        <div className={styles.body}>
            {props.loading && (
                <div className={styles.empty}>加载中...</div>
            )}
            {!props.loading && props.resources.length === 0 && (
                <div className={styles.empty}>
                    暂无资源
                    <div className={styles.tip}>请在工作台「备课中心-资源库」中添加素材</div>
                </div>
            )}
            {!props.loading && props.resources.length > 0 && (
                <ul className={styles.list}>
                    {props.resources.map(r => (
                        <li
                            key={r.id}
                            className={styles.item}
                            onClick={() => props.onImport(r)}
                            title={`点击导入：${r.name}`}
                        >
                            <span className={styles.itemIcon}>
                                {r.type === 'sound' ? '🎵' : '🖼'}
                            </span>
                            <span className={styles.itemName}>{r.name}</span>
                            <span className={styles.itemType}>{r.type}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    </div>
);

LocalResourceLibrary.propTypes = {
    loading: PropTypes.bool,
    resources: PropTypes.arrayOf(PropTypes.shape({
        id: PropTypes.string,
        name: PropTypes.string,
        type: PropTypes.string,
        filePath: PropTypes.string
    })),
    onRefresh: PropTypes.func,
    onImport: PropTypes.func
};

LocalResourceLibrary.defaultProps = {
    loading: false,
    resources: [],
    onRefresh: () => {},
    onImport: () => {}
};

export default LocalResourceLibrary;
