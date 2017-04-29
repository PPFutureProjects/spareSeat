import { Component } from '@angular/core';
import { NavController, ToastController, NavParams, MenuController } from 'ionic-angular';

//types
import { TripTypeEnum, TripObjectInterface, USERTYPES, appName, TripStatusEnum } from '../../app-types/app-types';

import { AngularFire, FirebaseListObservable } from 'angularfire2';
import { GoogleMapsAPIWrapper, MapsAPILoader } from 'angular2-google-maps/core';

import { MyTripsPage } from '../my-trips/my-trips';
import { ErrorHandler } from '../../providers/errorhandler';
import { tripRawToDbObject, toISOStringWithTZ } from '../../app-lib/utilities';

import { Auth } from '../../providers/auth';

import * as firebase from 'firebase';

@Component({
  selector: 'page-driver',
  templateUrl: 'driver.html',
  providers: [GoogleMapsAPIWrapper],
})
export class DriverPage {
  // Vars
  appTitle :string = appName;
  startTripLocation: any;
  endTripLocation: any;
  tripType: TripTypeEnum = TripTypeEnum.OneWay;
  allTripType = TripTypeEnum;
  currentTime: string = toISOStringWithTZ(new Date());
  maxTimeAccepted: string = toISOStringWithTZ(new Date(Date.now() + 3600 * 1000 * 24 * 60));
  endMaxTimeAccepted: string = this.maxTimeAccepted;
  dummyStartTime: number = 0;
  dummyEndTime: number = 0;
  canSubmit: boolean = true;

  trip: TripObjectInterface;

  driverTrips: FirebaseListObservable<any>;

  constructor(
    public navCtrl: NavController,
    public params: NavParams,
    public gApi: GoogleMapsAPIWrapper,
    public gLoader: MapsAPILoader,
    private toastCtrl: ToastController,
    private af: AngularFire,
    private eh: ErrorHandler,
    private auth: Auth,
    private menu: MenuController
  ) {
      this.menu.swipeEnable(false);

      this.driverTrips = af.database.list("/trips/" + auth.uid + "/driver");

      // View already existing trip
      this.trip = params.get('trip');

      if (this.trip) {
        this.canSubmit = false;
        this.startTripLocation = this.trip.startLocation.formatted_address;
        this.endTripLocation = this.trip.endLocation.formatted_address;
        this.initAddressAutoComplete();
      } else {
        // new trip
        this.trip = { userType: USERTYPES.driver.name, status: TripStatusEnum.Requested } ;
      }
    }

  ionViewDidLoad() {
    // setup GoogleMaps, Trip type
    this.trip.type = TripTypeEnum.OneWay;
    this.initAddressAutoComplete();
  }

  changeMaxTime(ev): void {
    let twoDigit = (v) => (v >= 10) ? v : `0${v}`;
    let { year: {value: Y}, month: {value: M}, day: {value: D}, hour: {value: H}, minute: {value: m} } = ev;
    // Note: format for the dateTime matters and following is the valid value. yyyy-mm-ddThh:min:secZ
    // Note: There is a bug with the input datatime as it doesnot respect the min value for the Hour and minute.
    this.endMaxTimeAccepted = `${Y}-${twoDigit(M + 2)}-${twoDigit(D)}T${twoDigit(H)}:${twoDigit(m)}:00Z`;
  }

  initAddressAutoComplete(): void {
    this.gLoader.load().then(() => {
      let startLocation = new google.maps.places.Autocomplete(document.getElementById("startLocation"), {});
      let endLocation = new google.maps.places.Autocomplete(document.getElementById("endLocation"), {});

      google.maps.event.addListener(startLocation, 'place_changed', () => {
        //console.log(startLocation.getPlace());
        this.trip.startLocation = startLocation.getPlace().geometry;
        this.trip.startLocation.formatted_address = startLocation.getPlace().formatted_address;
        this.trip.startLocation.name = startLocation.getPlace().name;
      });

      google.maps.event.addListener(endLocation, 'place_changed', () => {
        //console.log(endLocation.getPlace());
        this.trip.endLocation = endLocation.getPlace().geometry;
        this.trip.endLocation.formatted_address = endLocation.getPlace().formatted_address;
        this.trip.endLocation.name = endLocation.getPlace().name;
      });
    });
  }

  // distance() {
  //   this.trip.startLocation
  // }

    _areDatesValid(): boolean {
    this.dummyStartTime = (this.trip.startTime) ? +new Date(this.trip.startTime) : 0;
    if (this.dummyStartTime) {
      this.dummyEndTime = + new Date(this.trip.endTime);
      return this.dummyEndTime > this.dummyStartTime;
    }
    return true;
  }

  tripDatesOk(): boolean {
    if (!this._areDatesValid()) {
      this.showDateCorrectionToast();
      return false;
    }
    return true;
  }

  showDateCorrectionToast(): void {
    let toast = this.toastCtrl.create({
      message: 'Please correct Trip End Time.',
      duration: 3000,
      position: 'middle'
    });

    toast.present();
  }

  submitTripForm(ev: Event, tripFrom): void {
    ev.preventDefault();

    if (tripFrom.valid) {

      this.trip.createdAt = firebase.database.ServerValue.TIMESTAMP;
      this.trip.authId = this.auth.uid;

      let myDbOBject = tripRawToDbObject(this.trip);

      this.driverTrips.push(myDbOBject)
        .then(() => {
          this.navCtrl.remove(0);
          this.navCtrl.push(MyTripsPage, {
            trip: this.trip
          });
          }
        ).catch(this.eh.handle);
    }
  }
}
