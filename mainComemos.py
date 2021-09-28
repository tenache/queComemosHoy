# -*- coding: utf-8 -*-
"""
Created on Thu Sep 23 17:30:29 2021

@author: Usuario
"""

import clases
import random as rd
from classTodo import Todo
from clases import comida
from clases import ingrediente
from clases import side
import pickle as pkl
from time import sleep

def mainComemos():
    usuario = input('por Favor nombre al usuario ')
    # prioridad = input('si queres priorizar algo en particular, escribi: reciente,rico, costo, salud o tiempo. Sino, enter')
    # while prioridad not in ['reciente','rico','costo','tiempo','salud','']:
    #     prioridad = input('Disculpa, no entendi cual es tu prioridad')
    try:
        with open(f'{usuario}.pkl','rb') as file:
            usuario = pkl.load(file)
    except FileNotFoundError:
        dataC = input("Archivo con las comidas principales")
        dataG = input("Archivo con guarniciones o acompañamientos")
        usuario = Todo(usuario)
        usuario.cargarComidas(dataC)
        usuario.cargarGuarniciones(dataG)
    def eligePorMi(usuario,reciente=1,costo=1,salud=1,rico=1,tiempo=1):
        if type(usuario) != Todo:
            print('el argumento debe ser de tipo "Todo"')
        else:
            for guarnicion,food in usuario.guarniciones:
                guarnicion.calcularPeso()
            for food in usuario.comidas:
                food.calcularPeso()
            #elige una comida al azar de todas las opciones
            preComida = rd.choices(usuario.comidas,[food.peso for food in usuario.comidas])[0]
            #elige una guarnicion al azar de todas las opciones
            preGuarnicion =rd.choices(usuario.guarniciones, [guarnicion.peso for guarnicion in usuario.guarniciones])[0]
            #elige una guarnicion especifica entre las opciones de la comida preseleccionada.
            guarComida = rd.choices(preComida.guarniciones,[guarnicion.peso for guarnicion in preComida.guarniciones])[0]
            #elige una comida entre las opciones de la guarnicion preseleccionada
            comidaGuar = rd.choices(preGuarnicion.comidas,[food.peso for food in preGuarnicion.comidas])[0]
            opcion1 = preComida.peso + guarComida.peso
            opcion2= preGuarnicion.peso + comidaGuar.peso
            if opcion1 > opcion2:
                comidaDelDia = preComida,guarComida
            else:
                comidaDelDia = preGuarnicion,guarComida
            return comidaDelDia
    comidaDelDia = eligePorMi(usuario)        
    print(f'comidaDelDia es {comidaDelDia[0]}con {comidaDelDia[1]}')
    sleep(2)
    deAcuerdo=input('Estas de acuerdo con esa comida?(S/N)')
    while deAcuerdo[0] == 'N' or deAcuerdo[0] == 'n':
        comidaDelDia = eligePorMi(usuario)
        deAcuerdo=input('Estas de acuerdo con esa comida?(S/N). Q para salir')
        if deAcuerdo[0] == 'Q' or deAcuerdo[0] == 'q':
            break
    if deAcuerdo[0] == 's' or deAcuerdo[0] == 'S':
        for food in usuario.comidas:
            food.reciente += 5/len(usuario.comidas)
        for guar in usuario.guarniciones:
            guar += 5/len(usuario.guarniciones)
        for ingr in usuario.ingredientes:
            ingr.reciente += 5/len(usuario.ingredientes)
        for i in range(2):
            comidaDelDia[i].reciente = 1
        for ingr in comidaDelDia[i].ingredientes:
            ingr.reciente = 1
if __name__ == '__main__':
    mainComemos()

        

        
            

    


