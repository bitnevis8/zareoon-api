const moment = require("moment-jalaali");
moment.locale("fa".fa);
class myDate {
  jalaliToDate = (jalaliDate) => {
    // جدا کردن تاریخ و زمان از هم
    const [date, time] = jalaliDate.split(" - ");

    console.log("تاریخ:", date); // چاپ تاریخ
    console.log("زمان:", time); // چاپ زمان

    // تبدیل اعداد فارسی به انگلیسی در تاریخ
    const [year, month, day] = date.split("/").map((num) => num.replace(/[۰-۹]/g, (d) => "0123456789".charAt("۰۱۲۳۴۵۶۷۸۹".indexOf(d))));

    // جدا کردن ساعت و دقیقه و تبدیل به عدد
    const [hour, minute] = time.split(":").map((num) => parseInt(num.replace(/[۰-۹]/g, (d) => "0123456789".charAt("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))));

    console.log("ساعت:", hour); // چاپ ساعت
    console.log("دقیقه:", minute); // چاپ دقیقه

    // تبدیل تاریخ شمسی به میلادی
    const gregorianDate = moment(`${year}/${month}/${day}`, "jYYYY/jMM/jDD");

    console.log("تاریخ میلادی:", gregorianDate.toDate()); // چاپ تاریخ میلادی

    // تبدیل به تاریخ میلادی در قالب شی Date
    const dateObj = gregorianDate.toDate();

    // اضافه کردن زمان به تاریخ میلادی
    dateObj.setHours(hour);
    dateObj.setMinutes(minute);

    return dateObj;
  };
  //-----------------------------------
  dateToJalali = (date) => {
    // تبدیل تاریخ میلادی به تاریخ شمسی
    const jalaliDate = moment(date).format("jYYYY/jMM/jDD - HH:mm");
    return jalaliDate;
  };
  //------------------
  //-----------------------------------

  timeAgo = (jalaliDate, locale = "fa") => {
    moment.locale(locale);
    // تبدیل تاریخ شمسی به تاریخ میلادی
    const dateObj = this.jalaliToDate(jalaliDate);
    // محاسبه زمان گذشته و نمایش به صورت مناسب
    const timeAgo = moment(dateObj).fromNow();

    return timeAgo;
  };
}

module.exports = new myDate();
