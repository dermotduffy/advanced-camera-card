import { ScopedRegistryHost } from '@lit-labs/scoped-registry-mixin';
import {
  CSSResultGroup,
  html,
  LitElement,
  PropertyValues,
  TemplateResult,
  unsafeCSS,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { createRef, ref, Ref } from 'lit/directives/ref.js';
import { CameraManager } from '../camera-manager/manager';
import { ViewManagerEpoch } from '../card-controller/view/types';
import {
  MediaFilterController,
  MediaFilterCoreWhen,
} from '../components-lib/media-filter-controller';
import { CardWideConfig } from '../config/schema/types';
import { HomeAssistant } from '../ha/types';
import { localize } from '../localize/localize';
import mediaFilterStyle from '../scss/media-filter.scss';
import { AdvancedCameraCardDatePicker } from './date-picker';
import './date-picker.js';
import { AdvancedCameraCardSelect } from './select';
import './select.js';

@customElement('advanced-camera-card-media-filter')
class AdvancedCameraCardMediaFilter extends ScopedRegistryHost(LitElement) {
  @property({ attribute: false })
  public hass?: HomeAssistant;

  @property({ attribute: false })
  public cameraManager?: CameraManager;

  @property({ attribute: false })
  public viewManagerEpoch?: ViewManagerEpoch;

  @property({ attribute: false })
  public cardWideConfig?: CardWideConfig;

  static elementDefinitions = {
    'advanced-camera-card-select': AdvancedCameraCardSelect,
    'advanced-camera-card-date-picker': AdvancedCameraCardDatePicker,
  };

  protected _mediaFilterController = new MediaFilterController(this);

  protected _refMediaType: Ref<AdvancedCameraCardSelect> = createRef();
  protected _refCamera: Ref<AdvancedCameraCardSelect> = createRef();
  protected _refWhen: Ref<AdvancedCameraCardSelect> = createRef();
  protected _refWhenFrom: Ref<AdvancedCameraCardDatePicker> = createRef();
  protected _refWhenTo: Ref<AdvancedCameraCardDatePicker> = createRef();
  protected _refWhat: Ref<AdvancedCameraCardSelect> = createRef();
  protected _refWhere: Ref<AdvancedCameraCardSelect> = createRef();
  protected _refFavorite: Ref<AdvancedCameraCardSelect> = createRef();
  protected _refReviewed: Ref<AdvancedCameraCardSelect> = createRef();
  protected _refTags: Ref<AdvancedCameraCardSelect> = createRef();

  protected willUpdate(changedProps: PropertyValues): void {
    if (changedProps.has('viewManagerEpoch')) {
      this._mediaFilterController.setViewManager(this.viewManagerEpoch?.manager ?? null);
    }

    if (changedProps.has('cameraManager') && this.cameraManager) {
      this._mediaFilterController.computeCameraOptions(this.cameraManager);
      this._mediaFilterController.computeMetadataOptions(this.cameraManager);
    }

    // The first time the viewManager is set, compute the initial default selections.
    if (
      !changedProps.get('viewManager') &&
      this.viewManagerEpoch &&
      this.cameraManager
    ) {
      this._mediaFilterController.computeInitialDefaultsFromView(this.cameraManager);
    }
  }

  protected render(): TemplateResult | void {
    const valueChange = async () => {
      if (!this.cameraManager || !this.viewManagerEpoch || !this.cardWideConfig) {
        return;
      }
      await this._mediaFilterController.valueChangeHandler(
        this.cameraManager,
        this.cardWideConfig,
        {
          camera: this._refCamera.value?.value ?? undefined,
          mediaTypes: this._refMediaType.value?.value ?? undefined,
          when: {
            selected: this._refWhen.value?.value ?? undefined,
            from: this._refWhenFrom.value?.value,
            to: this._refWhenTo.value?.value,
          },
          favorite: this._refFavorite.value?.value ?? undefined,
          reviewed: this._refReviewed.value?.value ?? undefined,
          where: this._refWhere.value?.value ?? undefined,
          what: this._refWhat.value?.value ?? undefined,
          tags: this._refTags.value?.value ?? undefined,
        },
      );
    };

    // Ensure that the "When" selector and the custom calendar to/from selectors
    // are ~mutually exclusive.
    const whenChange = async (whenPriority?: 'custom' | 'selected'): Promise<void> => {
      if (whenPriority === 'custom' && this._refWhen.value) {
        if (!this._refWhenFrom.value?.value && !this._refWhenTo.value?.value) {
          this._refWhen.value.reset();
        } else {
          this._refWhen.value.value = MediaFilterCoreWhen.Custom;
        }
      } else if (this._refWhen.value?.value !== MediaFilterCoreWhen.Custom) {
        this._refWhenFrom.value?.reset();
        this._refWhenTo.value?.reset();
      }
      await valueChange();
    };

    if (!this.cameraManager || !this.viewManagerEpoch) {
      return;
    }

    const defaults = this._mediaFilterController.getDefaults();
    const whatOptions = this._mediaFilterController.getWhatOptions();
    const tagsOptions = this._mediaFilterController.getTagsOptions();
    const whereOptions = this._mediaFilterController.getWhereOptions();

    return html` <advanced-camera-card-select
        ${ref(this._refMediaType)}
        label=${localize('media_filter.media_type')}
        placeholder=${localize('media_filter.select_media_type')}
        .options=${this._mediaFilterController.getMediaTypeOptions()}
        .initialValue=${defaults?.mediaTypes}
        multiple
        clearable
        @advanced-camera-card:select:change=${() => valueChange()}
      >
      </advanced-camera-card-select>
      <div class="when">
        <advanced-camera-card-select
          ${ref(this._refWhen)}
          .label=${localize('media_filter.when')}
          placeholder=${localize('media_filter.select_when')}
          .options=${this._mediaFilterController.getWhenOptions()}
          .initialValue=${defaults?.when}
          clearable
          @advanced-camera-card:select:change=${() => whenChange('selected')}
        >
        </advanced-camera-card-select>
        <advanced-camera-card-date-picker
          class="${classMap({
            selected: !!this._refWhenFrom.value?.value,
            hidden: this._refWhen.value?.value !== MediaFilterCoreWhen.Custom,
          })}"
          ${ref(this._refWhenFrom)}
          .icon=${'mdi:calendar-arrow-right'}
          @advanced-camera-card:date-picker:change=${() => whenChange('custom')}
        >
        </advanced-camera-card-date-picker>
        <advanced-camera-card-date-picker
          class="${classMap({
            selected: !!this._refWhenTo.value?.value,
            hidden: this._refWhen.value?.value !== MediaFilterCoreWhen.Custom,
          })}"
          ${ref(this._refWhenTo)}
          .icon=${'mdi:calendar-arrow-left'}
          @advanced-camera-card:date-picker:change=${() => whenChange('custom')}
        >
        </advanced-camera-card-date-picker>
      </div>
      <advanced-camera-card-select
        ${ref(this._refCamera)}
        .label=${localize('media_filter.camera')}
        placeholder=${localize('media_filter.select_camera')}
        .options=${this._mediaFilterController.getCameraOptions()}
        .initialValue=${defaults?.cameraIDs}
        clearable
        multiple
        @advanced-camera-card:select:change=${() => valueChange()}
      >
      </advanced-camera-card-select>
      ${whatOptions.length
        ? html` <advanced-camera-card-select
            ${ref(this._refWhat)}
            label=${localize('media_filter.what')}
            placeholder=${localize('media_filter.select_what')}
            clearable
            multiple
            .options=${whatOptions}
            .initialValue=${defaults?.what}
            @advanced-camera-card:select:change=${() => valueChange()}
          >
          </advanced-camera-card-select>`
        : ''}
      ${tagsOptions.length
        ? html` <advanced-camera-card-select
            ${ref(this._refTags)}
            label=${localize('media_filter.tag')}
            placeholder=${localize('media_filter.select_tag')}
            clearable
            multiple
            .options=${tagsOptions}
            .initialValue=${defaults?.tags}
            @advanced-camera-card:select:change=${() => valueChange()}
          >
          </advanced-camera-card-select>`
        : ''}
      ${whereOptions.length
        ? html` <advanced-camera-card-select
            ${ref(this._refWhere)}
            label=${localize('media_filter.where')}
            placeholder=${localize('media_filter.select_where')}
            clearable
            multiple
            .options=${whereOptions}
            .initialValue=${defaults?.where}
            @advanced-camera-card:select:change=${() => valueChange()}
          >
          </advanced-camera-card-select>`
        : ''}
      <advanced-camera-card-select
        ${ref(this._refFavorite)}
        label=${localize('media_filter.favorite')}
        placeholder=${localize('media_filter.select_favorite')}
        .options=${this._mediaFilterController.getFavoriteOptions()}
        .initialValue=${defaults?.favorite}
        clearable
        @advanced-camera-card:select:change=${() => valueChange()}
      >
      </advanced-camera-card-select>
      <advanced-camera-card-select
        ${ref(this._refReviewed)}
        label=${localize('media_filter.reviewed')}
        placeholder=${localize('media_filter.select_reviewed')}
        .options=${this._mediaFilterController.getReviewedOptions()}
        .initialValue=${defaults?.reviewed}
        clearable
        @advanced-camera-card:select:change=${() => valueChange()}
      >
      </advanced-camera-card-select>`;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(mediaFilterStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-media-filter': AdvancedCameraCardMediaFilter;
  }
}
